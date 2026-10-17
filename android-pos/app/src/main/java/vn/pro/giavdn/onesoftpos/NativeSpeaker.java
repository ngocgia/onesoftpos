package vn.pro.giavdn.onesoftpos;

import android.app.Activity;
import android.media.AudioAttributes;
import android.media.AudioManager;
import android.media.ToneGenerator;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.speech.tts.TextToSpeech;
import android.speech.tts.UtteranceProgressListener;
import android.speech.tts.Voice;
import android.widget.Toast;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/** Activity-owned audio: no WebView SpeechSynthesis dependency. */
final class NativeSpeaker {
    private final Activity activity;
    private final Handler handler = new Handler(Looper.getMainLooper());
    private final ArrayDeque<Runnable> pending = new ArrayDeque<>();
    private final List<ToneGenerator> tones = new ArrayList<>();
    private TextToSpeech speech;
    private boolean ready, initializing, closed;
    private long utteranceId;

    NativeSpeaker(Activity activity) { this.activity = activity; }

    private void message(String message) {
        handler.post(() -> { if (!closed && !activity.isFinishing()) Toast.makeText(activity, message, Toast.LENGTH_LONG).show(); });
    }

    void beep(int volume) {
        if (closed || volume <= 0) return;
        try {
            ToneGenerator tone = new ToneGenerator(AudioManager.STREAM_MUSIC, Math.min(100, volume));
            tones.add(tone);
            if (!tone.startTone(ToneGenerator.TONE_PROP_ACK, 450)) message("Không phát được chuông. Kiểm tra âm lượng phương tiện.");
            handler.postDelayed(() -> { tones.remove(tone); tone.release(); }, 650);
        } catch (Exception error) { message("Không phát được chuông: " + error.getMessage()); }
    }

    void speak(String text, int volume) {
        if (closed || volume <= 0 || text == null || text.trim().isEmpty()) return;
        // Split long announcements at the engine limit without dropping the last items.
        int limit = Math.min(3000, TextToSpeech.getMaxSpeechInputLength());
        for (int start = 0; start < text.length(); start += limit) {
            String part = text.substring(start, Math.min(text.length(), start + limit));
            Runnable job = () -> {
                Bundle params = new Bundle();
                params.putFloat(TextToSpeech.Engine.KEY_PARAM_VOLUME, Math.min(100, volume) / 100f);
                if (speech.speak(part, TextToSpeech.QUEUE_ADD, params, "pos-" + (++utteranceId)) == TextToSpeech.ERROR) message("Không đọc được thông báo. Kiểm tra bộ đọc tiếng Việt trong Cài đặt Android.");
            };
            if (ready) job.run();
            else {
                if (pending.size() >= 20) { message("Hàng đợi thông báo đã đầy. Vui lòng thử lại sau."); break; }
                pending.add(job);
            }
        }
        if (!ready && !initializing) {
            initializing = true;
            try {
                speech = new TextToSpeech(activity.getApplicationContext(), status -> handler.post(() -> {
                    try { onInitialized(status); }
                    catch (Exception error) { fail("Không khởi động được giọng đọc tiếng Việt: " + error.getMessage()); }
                }));
            } catch (Exception error) { fail("Không mở được bộ đọc giọng nói: " + error.getMessage()); }
        }
    }

    private void onInitialized(int status) {
        initializing = false;
        if (closed) return;
        if (status != TextToSpeech.SUCCESS) { fail("Chưa có bộ đọc giọng nói. Hãy cài hoặc bật dịch vụ chuyển văn bản thành giọng nói tiếng Việt trong Android."); return; }
        int language = speech.setLanguage(Locale.forLanguageTag("vi-VN"));
        if (language < 0) {
            fail("Thiếu giọng đọc tiếng Việt. Hãy tải tiếng Việt trong Cài đặt Android → Chuyển văn bản thành giọng nói."); return;
        }
        if (speech.getVoices() != null) {
            for (Voice voice : speech.getVoices()) {
                if ("vi".equals(voice.getLocale().getLanguage()) && !voice.isNetworkConnectionRequired()
                        && (voice.getFeatures() == null || !voice.getFeatures().contains(TextToSpeech.Engine.KEY_FEATURE_NOT_INSTALLED))) { speech.setVoice(voice); break; }
            }
        }
        speech.setAudioAttributes(new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_MEDIA).setContentType(AudioAttributes.CONTENT_TYPE_SPEECH).build());
        speech.setSpeechRate(0.95f);
        speech.setOnUtteranceProgressListener(new UtteranceProgressListener() {
            @Override public void onStart(String id) {}
            @Override public void onDone(String id) {}
            @Override public void onError(String id) { message("Không đọc được thông báo. Kiểm tra giọng tiếng Việt, âm lượng phương tiện và kết nối loa."); }
        });
        ready = true;
        while (!pending.isEmpty()) pending.removeFirst().run();
    }

    private void fail(String message) {
        pending.clear(); ready = false; initializing = false;
        if (speech != null) { speech.shutdown(); speech = null; }
        message(message);
    }

    void close() {
        closed = true;
        handler.removeCallbacksAndMessages(null);
        pending.clear();
        for (ToneGenerator tone : tones) tone.release();
        tones.clear();
        if (speech != null) { speech.stop(); speech.shutdown(); }
    }
}
