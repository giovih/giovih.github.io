import Foundation

/// In che settimana del programma sono: cicli di 8 settimane, l'ottava è di scarico.
struct ProgramWeek: Equatable {
    /// Settimana totale: 1, 2, 3, ... 9, 10...
    let number: Int

    /// Settimana nel ciclo: 1...8.
    var cycle: Int { (number - 1) % 8 + 1 }
    /// Settimana 8: metà serie e -10% di peso.
    var isDeload: Bool { cycle == 8 }
    /// Drop set attivi dalla settimana 5 alla 7.
    var dropSetsActive: Bool { cycle >= 5 && cycle < 8 }
    /// Settimana di diario: 1, 4, 8, 12...
    var isDiaryWeek: Bool { number == 1 || number % 4 == 0 }

    static func current(start: Date, now: Date = .now, calendar: Calendar = .italian) -> ProgramWeek {
        let a = calendar.startOfWeek(for: start)
        let b = calendar.startOfWeek(for: now)
        let days = calendar.dateComponents([.day], from: a, to: b).day ?? 0
        // arrotondo per il cambio dell'ora legale
        let weeks = Int((Double(days) / 7).rounded())
        return ProgramWeek(number: max(0, weeks) + 1)
    }
}
