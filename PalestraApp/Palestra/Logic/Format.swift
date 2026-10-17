import Foundation

/// Testi brevi usati in tutta l'app.
enum Format {
    /// "4 x 6-8" oppure "3 x 15".
    static func setsReps(_ sets: Int, _ a: Int, _ b: Int) -> String {
        a == b ? "\(sets) × \(a)" : "\(sets) × \(a)-\(b)"
    }

    /// "2-3 min", "90 s", "60-90 s".
    static func rest(_ a: Int, _ b: Int) -> String {
        if a >= 120 && a % 60 == 0 && b % 60 == 0 {
            return a == b ? "\(a / 60) min" : "\(a / 60)-\(b / 60) min"
        }
        return a == b ? "\(a) s" : "\(a)-\(b) s"
    }

    /// 62.5 → "62,5", 60 → "60".
    static func kg(_ v: Double) -> String {
        let r = (v * 100).rounded() / 100
        return r == r.rounded() ? String(Int(r)) : String(r).replacingOccurrences(of: ".", with: ",")
    }

    /// Legge numeri scritti all'italiana ("56,4").
    static func parse(_ s: String) -> Double? {
        Double(s.trimmingCharacters(in: .whitespaces).replacingOccurrences(of: ",", with: "."))
    }

    /// "1:05" oppure "1:02:03".
    static func duration(_ seconds: Int) -> String {
        let s = max(0, seconds)
        let h = s / 3600, m = (s / 60) % 60, sec = s % 60
        return h > 0 ? String(format: "%d:%02d:%02d", h, m, sec) : String(format: "%d:%02d", m, sec)
    }

    /// Chiave di un giorno, es. "2026-10-17".
    static func dayKey(_ date: Date) -> String {
        let c = Calendar.italian.dateComponents([.year, .month, .day], from: date)
        return String(format: "%04d-%02d-%02d", c.year!, c.month!, c.day!)
    }

    static func shortDate(_ date: Date) -> String {
        date.formatted(.dateTime.weekday(.abbreviated).day().month(.abbreviated).locale(Locale(identifier: "it_IT")))
    }
}

extension Calendar {
    /// Calendario con la settimana che inizia di lunedì.
    static var italian: Calendar {
        var c = Calendar(identifier: .gregorian)
        c.firstWeekday = 2
        c.locale = Locale(identifier: "it_IT")
        return c
    }

    func startOfWeek(for date: Date) -> Date {
        dateInterval(of: .weekOfYear, for: date)?.start ?? startOfDay(for: date)
    }
}
