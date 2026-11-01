import AVFoundation
import Foundation

/// Âm thanh do app sở hữu: không phụ thuộc SpeechSynthesis của WebView.
/// Tương đương NativeSpeaker.java của bản Android (beep + đọc thông báo tiếng Việt).
final class NativeSpeaker {
    private let message: (String) -> Void
    private let synthesizer = AVSpeechSynthesizer()
    private var cachedBeep: Data?
    private var vietnameseVoice: AVSpeechSynthesisVoice?
    private var voiceChecked = false
    private var closed = false

    init(message: @escaping (String) -> Void) {
        self.message = message
    }

    /// Chuông hai tông giống nhánh fallback WebAudio của web (587 Hz rồi 880 Hz).
    func beep(volume: Int) {
        guard !closed, volume > 0 else { return }
        do {
            let player = try AVAudioPlayer(data: beepData())
            player.volume = Float(min(100, max(0, volume))) / 100
            player.prepareToPlay()
            player.play()
        } catch {
            message("Không phát được chuông. Kiểm tra âm lượng phương tiện.")
        }
    }

    /// Đọc thông báo bằng giọng tiếng Việt, chia câu dài 3000 ký tự,
    /// xếp hàng tự nhiên như QUEUE_ADD của Android.
    func speak(_ text: String, volume: Int) {
        guard !closed, volume > 0 else { return }
        let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return }
        if !voiceChecked {
            voiceChecked = true
            vietnameseVoice = AVSpeechSynthesisVoice(language: "vi-VN")
        }
        guard vietnameseVoice != nil else {
            message("Thiếu giọng đọc tiếng Việt. Hãy mở Cài đặt → Trợ năng → Nội dung được nói → Giọng nói rồi tải giọng Tiếng Việt (vi-VN).")
            return
        }
        let limit = 3000
        var start = trimmed.startIndex
        while start < trimmed.endIndex {
            let end = trimmed.index(start, offsetBy: limit, limitedBy: trimmed.endIndex) ?? trimmed.endIndex
            let part = String(trimmed[start..<end])
            let utterance = AVSpeechUtterance(string: part)
            utterance.voice = vietnameseVoice
            utterance.volume = Float(min(100, max(0, volume))) / 100
            utterance.rate = AVSpeechUtteranceDefaultSpeechRate * 0.95
            synthesizer.speak(utterance)
            start = end
        }
    }

    func close() {
        closed = true
        synthesizer.stopSpeaking(at: .immediate)
    }

    // MARK: - Chuông

    private func beepData() throws -> Data {
        if let cached = cachedBeep { return cached }
        let sampleRate = 44100.0
        let tones: [(frequency: Double, seconds: Double)] = [(587.33, 0.18), (880.0, 0.20)]
        let gap = 0.05
        let total = tones.reduce(0.0) { $0 + $1.seconds } + gap * Double(tones.count - 1)
        let totalSamples = Int(total * sampleRate)
        var samples = [Int16](repeating: 0, count: totalSamples)
        var cursor = 0
        for tone in tones {
            let count = Int(tone.seconds * sampleRate)
            for i in 0..<count where cursor + i < totalSamples {
                let t = Double(i) / sampleRate
                // Nhịp gợn đầu/cuối để không bị nút lọc tiếng.
                let fade = min(1.0, min(t / 0.01, (tone.seconds - t) / 0.02))
                let value = sin(2 * .pi * tone.frequency * t) * fade * 0.8
                samples[cursor + i] = Int16(max(-1, min(1, value)) * Double(Int16.max))
            }
            cursor += count + Int(gap * sampleRate)
        }
        var data = Data()
        func append(_ value: UInt32) {
            withUnsafeBytes(of: value.littleEndian) { data.append(contentsOf: $0) }
        }
        func append16(_ value: UInt16) {
            withUnsafeBytes(of: value.littleEndian) { data.append(contentsOf: $0) }
        }
        append(UInt32(0x46464952))                       // "RIFF"
        append(UInt32(36 + totalSamples * 2))            // kích thước phần sau
        append(UInt32(0x45564157))                       // "WAVE"
        append(UInt32(0x20746d66))                       // "fmt "
        append(UInt32(16))                               // cỡ khối fmt
        append16(UInt16(1))                              // PCM
        append16(UInt16(1))                              // một kênh
        append(UInt32(sampleRate))
        append(UInt32(sampleRate * 2))                   // byte rate
        append16(UInt16(2))                              // block align
        append16(UInt16(16))                             // bit mỗi mẫu
        append(UInt32(0x61746164))                       // "data"
        append(UInt32(totalSamples * 2))
        samples.withUnsafeBytes { data.append(contentsOf: $0) }
        cachedBeep = data
        return data
    }
}
