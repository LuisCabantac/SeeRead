//! Microphone capture (cpal) and local streaming speech recognition (sherpa-onnx).
//!
//! Everything runs on one worker thread per session: the audio callback only downmixes
//! and hands buffers over a bounded channel (dropping audio rather than ever blocking the
//! audio thread), and the worker feeds the recognizer and emits results to the UI.
//! Audio and transcripts never leave the process and are never written to disk or logs.

use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex, mpsc};
use std::thread::JoinHandle;
use std::time::{Duration, Instant};

use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use serde::{Deserialize, Serialize};
use sherpa_onnx::{OnlineRecognizer, OnlineRecognizerConfig};
use tauri::{AppHandle, Emitter, Manager, State};

use crate::error::CmdError;

const LEVEL_INTERVAL: Duration = Duration::from_millis(100);
const MAX_HOTWORDS: usize = 400;

#[derive(Default)]
pub struct SpeechState(Mutex<Option<Session>>);

struct Session {
    stop: Arc<AtomicBool>,
    handle: JoinHandle<()>,
}

impl Session {
    fn finish(self) {
        self.stop.store(true, Ordering::SeqCst);
        let _ = self.handle.join();
    }
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InputDevice {
    id: String,
    name: String,
    is_default: bool,
}

#[tauri::command]
pub async fn list_input_devices() -> Result<Vec<InputDevice>, CmdError> {
    let host = cpal::default_host();
    let default_id = host.default_input_device().and_then(|d| d.id().ok());
    let devices = host.input_devices().map_err(audio_error)?;
    Ok(devices
        .filter_map(|d| {
            let id = d.id().ok()?;
            let name = d
                .description()
                .map(|desc| desc.name().to_string())
                .unwrap_or_else(|_| id.to_string());
            Some(InputDevice {
                is_default: Some(&id) == default_id.as_ref(),
                id: id.to_string(),
                name,
            })
        })
        .collect())
}

/// Files of a sherpa-onnx streaming transducer model.
#[derive(Debug, PartialEq)]
struct ModelFiles {
    encoder: PathBuf,
    decoder: PathBuf,
    joiner: PathBuf,
    tokens: PathBuf,
    /// Present for BPE models; enables script-vocabulary hotword biasing.
    bpe_vocab: Option<PathBuf>,
}

fn find_onnx(dir: &Path, prefix: &str) -> Option<PathBuf> {
    let mut candidates: Vec<PathBuf> = std::fs::read_dir(dir)
        .ok()?
        .filter_map(|e| e.ok().map(|e| e.path()))
        .filter(|p| {
            let name = p.file_name().and_then(|n| n.to_str()).unwrap_or_default();
            name.starts_with(prefix) && name.ends_with(".onnx")
        })
        .collect();
    // Prefer quantized weights: smaller and faster, with negligible accuracy loss.
    candidates.sort_by_key(|p| !p.to_string_lossy().contains(".int8."));
    candidates.into_iter().next()
}

fn model_files(dir: &Path) -> Option<ModelFiles> {
    let tokens = dir.join("tokens.txt");
    let bpe_vocab = dir.join("bpe.vocab");
    Some(ModelFiles {
        encoder: find_onnx(dir, "encoder")?,
        decoder: find_onnx(dir, "decoder")?,
        joiner: find_onnx(dir, "joiner")?,
        tokens: tokens.is_file().then_some(tokens)?,
        bpe_vocab: bpe_vocab.is_file().then_some(bpe_vocab),
    })
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ModelInfo {
    dir: String,
    name: String,
    bundled: bool,
    hotwords: bool,
}

fn bundled_models_dir(app: &AppHandle) -> Option<PathBuf> {
    app.path()
        .resource_dir()
        .ok()
        .map(|d| d.join("resources").join("models"))
}

#[tauri::command]
pub async fn list_models(app: AppHandle, extra_dirs: Vec<String>) -> Vec<ModelInfo> {
    let mut found = Vec::new();
    if let Some(root) = bundled_models_dir(&app)
        && let Ok(entries) = std::fs::read_dir(root)
    {
        for dir in entries.filter_map(|e| e.ok().map(|e| e.path())) {
            if let Some(files) = model_files(&dir) {
                found.push((dir, true, files));
            }
        }
    }
    for dir in extra_dirs.into_iter().map(PathBuf::from) {
        if found.iter().any(|(known, _, _)| known == &dir) {
            continue; // the user picked a bundled model
        }
        if let Some(files) = model_files(&dir) {
            found.push((dir, false, files));
        }
    }
    found
        .into_iter()
        .map(|(dir, bundled, files)| ModelInfo {
            name: dir
                .file_name()
                .map(|n| n.to_string_lossy().into_owned())
                .unwrap_or_default(),
            dir: dir.to_string_lossy().into_owned(),
            bundled,
            hotwords: files.bpe_vocab.is_some(),
        })
        .collect()
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StartOptions {
    session: u32,
    device_id: Option<String>,
    model_dir: String,
    gain: f32,
    noise_gate: f32,
    /// Script words to bias recognition toward (used only with BPE models).
    hotwords: Vec<String>,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct StateEvent {
    session: u32,
    status: &'static str,
    code: Option<&'static str>,
    message: Option<String>,
}

#[derive(Serialize, Clone)]
struct ResultEvent<'a> {
    session: u32,
    seq: u32,
    text: &'a str,
    #[serde(rename = "final")]
    is_final: bool,
}

#[derive(Serialize, Clone)]
struct LevelEvent {
    session: u32,
    rms: f32,
    gated: bool,
}

#[tauri::command]
pub async fn start_speech(
    app: AppHandle,
    state: State<'_, SpeechState>,
    options: StartOptions,
) -> Result<(), CmdError> {
    let files = model_files(Path::new(&options.model_dir)).ok_or_else(|| {
        CmdError::new(
            "model_missing",
            "No usable speech model was found in the selected folder.",
        )
    })?;
    let previous = state.0.lock().map_err(|_| poisoned())?.take();
    if let Some(previous) = previous {
        previous.finish();
    }

    let stop = Arc::new(AtomicBool::new(false));
    let worker_stop = stop.clone();
    let session = options.session;
    let handle = std::thread::Builder::new()
        .name("seeread-speech".into())
        .spawn(move || {
            let result = run_session(&app, &options, &files, &worker_stop);
            let event = match result {
                Ok(()) => StateEvent {
                    session,
                    status: "stopped",
                    code: None,
                    message: None,
                },
                Err(e) => StateEvent {
                    session,
                    status: "error",
                    code: Some(e.code),
                    message: Some(e.message),
                },
            };
            let _ = app.emit("speech://state", event);
        })?;
    *state.0.lock().map_err(|_| poisoned())? = Some(Session { stop, handle });
    Ok(())
}

#[tauri::command]
pub async fn stop_speech(state: State<'_, SpeechState>) -> Result<(), CmdError> {
    let session = state.0.lock().map_err(|_| poisoned())?.take();
    if let Some(session) = session {
        session.finish();
    }
    Ok(())
}

fn poisoned() -> CmdError {
    CmdError::new(
        "internal",
        "Speech state is unavailable; please restart SeeRead.",
    )
}

fn audio_error(err: cpal::Error) -> CmdError {
    use cpal::ErrorKind;
    let (code, message) = match err.kind() {
        ErrorKind::PermissionDenied => (
            "mic_permission_denied",
            "SeeRead is not allowed to use the microphone. Allow it in your system's privacy settings.",
        ),
        ErrorKind::DeviceNotAvailable => (
            "mic_unavailable",
            "The selected microphone is not available.",
        ),
        ErrorKind::DeviceBusy => (
            "mic_busy",
            "The microphone is being used exclusively by another app.",
        ),
        ErrorKind::DeviceChanged | ErrorKind::StreamInvalidated => {
            ("mic_lost", "The microphone was disconnected or changed.")
        }
        _ => ("audio_error", "The microphone could not be opened."),
    };
    CmdError::new(code, format!("{message} ({err})"))
}

fn hotword_text(words: &[String]) -> String {
    let mut seen = std::collections::BTreeSet::new();
    words
        .iter()
        .map(|w| w.trim().to_uppercase())
        .filter(|w| w.chars().count() >= 4 && w.chars().all(|c| c.is_alphabetic() || c == '\''))
        .filter(|w| seen.insert(w.clone()))
        .take(MAX_HOTWORDS)
        .collect::<Vec<_>>()
        .join("\n")
}

fn create_recognizer(files: &ModelFiles, use_hotwords: bool) -> Result<OnlineRecognizer, CmdError> {
    let path = |p: &PathBuf| Some(p.to_string_lossy().into_owned());
    let mut config = OnlineRecognizerConfig::default();
    config.model_config.transducer.encoder = path(&files.encoder);
    config.model_config.transducer.decoder = path(&files.decoder);
    config.model_config.transducer.joiner = path(&files.joiner);
    config.model_config.tokens = path(&files.tokens);
    config.model_config.num_threads = 2;
    config.model_config.provider = Some("cpu".into());
    config.enable_endpoint = true;
    config.rule1_min_trailing_silence = 2.4;
    config.rule2_min_trailing_silence = 0.8;
    config.rule3_min_utterance_length = 20.0;
    match (&files.bpe_vocab, use_hotwords) {
        (Some(vocab), true) => {
            config.decoding_method = Some("modified_beam_search".into());
            config.max_active_paths = 4;
            config.model_config.modeling_unit = Some("bpe".into());
            config.model_config.bpe_vocab = path(vocab);
            config.hotwords_score = 1.5;
        }
        _ => config.decoding_method = Some("greedy_search".into()),
    }
    OnlineRecognizer::create(&config)
        .ok_or_else(|| CmdError::new("model_invalid", "The speech model could not be loaded."))
}

/// Streaming models spend their first ~0.5 s of input warming up, which would swallow
/// the first word after every (re)start. Feeding a second of silence absorbs it.
fn prime(recognizer: &OnlineRecognizer, asr: &sherpa_onnx::OnlineStream) {
    asr.accept_waveform(16_000, &[0f32; 16_000]);
    while recognizer.is_ready(asr) {
        recognizer.decode(asr);
    }
}

fn build_stream(
    device: &cpal::Device,
    tx: mpsc::SyncSender<Vec<f32>>,
    err_tx: mpsc::Sender<cpal::Error>,
) -> Result<(cpal::Stream, u32), CmdError> {
    use cpal::SampleFormat;
    let supported = device.default_input_config().map_err(audio_error)?;
    let sample_rate = supported.sample_rate();
    let channels = supported.channels().max(1) as usize;
    let format = supported.sample_format();
    let config = supported.config();

    fn downmix<T: Copy>(data: &[T], channels: usize, to_f32: impl Fn(T) -> f32) -> Vec<f32> {
        data.chunks(channels)
            .map(|frame| frame.iter().map(|&s| to_f32(s)).sum::<f32>() / frame.len() as f32)
            .collect()
    }
    // Never block the audio thread: if the worker falls behind, drop the buffer.
    let on_error = move |e| {
        let _ = err_tx.send(e);
    };
    let stream = match format {
        SampleFormat::F32 => device.build_input_stream(
            config,
            move |d: &[f32], _: &_| drop(tx.try_send(downmix(d, channels, |s| s))),
            on_error,
            None,
        ),
        SampleFormat::I16 => device.build_input_stream(
            config,
            move |d: &[i16], _: &_| drop(tx.try_send(downmix(d, channels, |s| s as f32 / 32768.0))),
            on_error,
            None,
        ),
        SampleFormat::I32 => device.build_input_stream(
            config,
            move |d: &[i32], _: &_| {
                drop(tx.try_send(downmix(d, channels, |s| s as f32 / 2_147_483_648.0)))
            },
            on_error,
            None,
        ),
        SampleFormat::U16 => device.build_input_stream(
            config,
            move |d: &[u16], _: &_| {
                drop(tx.try_send(downmix(d, channels, |s| (s as f32 - 32768.0) / 32768.0)))
            },
            on_error,
            None,
        ),
        other => {
            return Err(CmdError::new(
                "audio_format",
                format!("The microphone uses an unsupported sample format ({other:?})."),
            ));
        }
    }
    .map_err(audio_error)?;
    Ok((stream, sample_rate))
}

fn run_session(
    app: &AppHandle,
    options: &StartOptions,
    files: &ModelFiles,
    stop: &AtomicBool,
) -> Result<(), CmdError> {
    let session = options.session;
    let emit_state = |status| {
        let _ = app.emit(
            "speech://state",
            StateEvent {
                session,
                status,
                code: None,
                message: None,
            },
        );
    };
    emit_state("loading");

    let hotwords = hotword_text(&options.hotwords);
    let recognizer = create_recognizer(files, !hotwords.is_empty())?;
    let asr = if files.bpe_vocab.is_some() && !hotwords.is_empty() {
        recognizer.create_stream_with_hotwords(&hotwords)
    } else {
        recognizer.create_stream()
    };
    prime(&recognizer, &asr);

    let host = cpal::default_host();
    let device = options
        .device_id
        .as_deref()
        .and_then(|id| id.parse().ok())
        .and_then(|id| host.device_by_id(&id))
        .or_else(|| host.default_input_device())
        .ok_or_else(|| CmdError::new("mic_unavailable", "No microphone was found."))?;
    let (tx, rx) = mpsc::sync_channel::<Vec<f32>>(64);
    let (err_tx, err_rx) = mpsc::channel();
    let (stream, sample_rate) = build_stream(&device, tx, err_tx)?;
    stream.play().map_err(audio_error)?;
    emit_state("listening");

    let gain = options.gain.clamp(0.1, 8.0);
    let gate = options.noise_gate.clamp(0.0, 0.5);
    let mut seq = 0u32;
    let mut last_text = String::new();
    let (mut level_sum, mut level_n, mut level_at) = (0f64, 0usize, Instant::now());

    let mut emit_result = |text: &str, is_final: bool| {
        seq += 1;
        let _ = app.emit(
            "speech://result",
            ResultEvent {
                session,
                seq,
                text,
                is_final,
            },
        );
    };

    while !stop.load(Ordering::SeqCst) {
        if let Ok(err) = err_rx.try_recv() {
            use cpal::ErrorKind::{RealtimeDenied, Xrun};
            if !matches!(err.kind(), Xrun | RealtimeDenied) {
                return Err(audio_error(err));
            }
        }
        let mut chunk = match rx.recv_timeout(Duration::from_millis(100)) {
            Ok(chunk) => chunk,
            Err(mpsc::RecvTimeoutError::Timeout) => continue,
            Err(mpsc::RecvTimeoutError::Disconnected) => break,
        };
        let mut energy = 0f64;
        for s in chunk.iter_mut() {
            *s = (*s * gain).clamp(-1.0, 1.0);
            energy += f64::from(*s) * f64::from(*s);
        }
        let rms = (energy / chunk.len().max(1) as f64).sqrt();
        let gated = rms < f64::from(gate);
        if gated {
            // Feed silence rather than nothing so endpoint detection still sees the pause.
            chunk.fill(0.0);
        }
        level_sum += rms;
        level_n += 1;
        if level_at.elapsed() >= LEVEL_INTERVAL {
            let rms = (level_sum / level_n as f64) as f32;
            let _ = app.emit(
                "speech://level",
                LevelEvent {
                    session,
                    rms,
                    gated,
                },
            );
            (level_sum, level_n, level_at) = (0.0, 0, Instant::now());
        }

        asr.accept_waveform(sample_rate as i32, &chunk);
        while recognizer.is_ready(&asr) {
            recognizer.decode(&asr);
        }
        let text = recognizer
            .get_result(&asr)
            .map(|r| r.text)
            .unwrap_or_default();
        if text != last_text {
            emit_result(&text, false);
            last_text = text;
        }
        if recognizer.is_endpoint(&asr) {
            if !last_text.trim().is_empty() {
                emit_result(&last_text, true);
            }
            recognizer.reset(&asr);
            prime(&recognizer, &asr);
            last_text.clear();
        }
    }

    drop(stream);
    asr.input_finished();
    while recognizer.is_ready(&asr) {
        recognizer.decode(&asr);
    }
    let text = recognizer
        .get_result(&asr)
        .map(|r| r.text)
        .unwrap_or_default();
    if !text.trim().is_empty() {
        emit_result(&text, true);
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn hotwords_are_unique_uppercase_words_without_noise() {
        let words = [
            "hello", "Hello", "it's", "a", "twenty", "2024", "x-ray", "world",
        ]
        .map(String::from);
        assert_eq!(hotword_text(&words), "HELLO\nIT'S\nTWENTY\nWORLD");
    }

    #[test]
    fn hotwords_are_capped() {
        let words: Vec<String> = (1..1000)
            .map(|i| format!("word{}", "z".repeat(i)))
            .collect();
        assert_eq!(hotword_text(&words).lines().count(), MAX_HOTWORDS);
    }

    #[test]
    fn finds_model_files_and_prefers_int8() {
        let dir = tempfile::tempdir().unwrap();
        for name in [
            "encoder-epoch-99-avg-1.onnx",
            "encoder-epoch-99-avg-1.int8.onnx",
            "decoder-epoch-99-avg-1.onnx",
            "joiner-epoch-99-avg-1.int8.onnx",
            "tokens.txt",
        ] {
            std::fs::write(dir.path().join(name), "").unwrap();
        }
        let files = model_files(dir.path()).unwrap();
        assert!(files.encoder.ends_with("encoder-epoch-99-avg-1.int8.onnx"));
        assert!(files.decoder.ends_with("decoder-epoch-99-avg-1.onnx"));
        assert!(files.bpe_vocab.is_none());
    }

    /// Longest common subsequence length, for word accuracy.
    fn lcs(a: &[&str], b: &[&str]) -> usize {
        let mut row = vec![0usize; b.len() + 1];
        for x in a {
            let mut diag = 0;
            for (j, y) in b.iter().enumerate() {
                let up = row[j + 1];
                row[j + 1] = if x == y { diag + 1 } else { up.max(row[j]) };
                diag = up;
            }
        }
        row[b.len()]
    }

    /// Recognizes public-domain LibriSpeech recordings that ship with the model archive.
    /// Run after `npm run fetch:model` with `cargo test -- --ignored`. With
    /// `SEEREAD_WRITE_FIXTURES=1` it also records the partial-result stream to
    /// `tests/fixtures/asr/` for the TypeScript voice-tracking tests.
    #[test]
    #[ignore = "needs the speech model: run `npm run fetch:model` first"]
    fn recognizes_recorded_speech() {
        let root = Path::new(env!("CARGO_MANIFEST_DIR")).join("..");
        let files = model_files(&root.join("src-tauri/resources/models/en-us-zipformer-20M"))
            .expect("speech model not installed");
        let wavs = root.join(".cache/test_wavs");
        let transcripts =
            std::fs::read_to_string(wavs.join("trans.txt")).expect("test_wavs missing");
        let recognizer = create_recognizer(&files, false).unwrap();

        for line in transcripts.lines() {
            let Some((name, expected)) = line.split_once(' ') else {
                continue;
            };
            let path = wavs.join(name);
            if !path.exists() {
                continue;
            }
            let wave = sherpa_onnx::Wave::read(&path.to_string_lossy()).unwrap();
            let rate = wave.sample_rate();
            let asr = recognizer.create_stream();
            let mut partials: Vec<String> = Vec::new();
            let silence = vec![0f32; rate as usize / 2];
            // Same priming as a live session (see `prime`): recordings start abruptly.
            let lead = vec![0f32; rate as usize];
            let chunks = std::iter::once(&lead[..])
                .chain(wave.samples().chunks(rate as usize / 10))
                .chain(std::iter::once(&silence[..]));
            for chunk in chunks {
                asr.accept_waveform(rate, chunk);
                while recognizer.is_ready(&asr) {
                    recognizer.decode(&asr);
                }
                let text = recognizer
                    .get_result(&asr)
                    .map(|r| r.text)
                    .unwrap_or_default();
                if !text.is_empty() && partials.last() != Some(&text) {
                    partials.push(text);
                }
            }
            asr.input_finished();
            while recognizer.is_ready(&asr) {
                recognizer.decode(&asr);
            }
            let heard = recognizer
                .get_result(&asr)
                .map(|r| r.text)
                .unwrap_or_default();

            let want: Vec<&str> = expected.split_whitespace().collect();
            let got: Vec<&str> = heard.split_whitespace().collect();
            let accuracy = lcs(&want, &got) as f64 / want.len() as f64;
            println!("{name}: word accuracy {:.0}% — {heard}", accuracy * 100.0);
            assert!(
                accuracy >= 0.8,
                "{name}: accuracy {accuracy:.2} too low: {heard}"
            );

            if std::env::var_os("SEEREAD_WRITE_FIXTURES").is_some() {
                let out = root.join("tests/fixtures/asr");
                std::fs::create_dir_all(&out).unwrap();
                let fixture = serde_json::json!({
                    "source": format!("LibriSpeech recording {name} from the sherpa-onnx model archive"),
                    "script": expected,
                    "partials": partials,
                    "final": heard,
                });
                let json = serde_json::to_string_pretty(&fixture).unwrap();
                std::fs::write(
                    out.join(format!("{}.json", name.trim_end_matches(".wav"))),
                    json + "\n",
                )
                .unwrap();
            }
        }
    }

    #[test]
    fn rejects_incomplete_model_dirs() {
        let dir = tempfile::tempdir().unwrap();
        std::fs::write(dir.path().join("encoder.onnx"), "").unwrap();
        assert!(model_files(dir.path()).is_none());
        assert!(model_files(Path::new("/definitely/not/here")).is_none());
    }
}
