import Foundation

/// Tipo di attrezzo: decide come si incrementa il peso e come si mostra (es. "per manubrio").
enum Equipment: String, Codable, CaseIterable, Identifiable {
    case barbell      // bilanciere: +2,5 kg (1,25 per lato)
    case dumbbell     // manubri: peso PER MANUBRIO, +1-2 kg
    case machine      // macchina: +1 tacca
    case cable        // cavi: +1 tacca
    case bodyweight   // trazioni, dip: prima ripetizioni, poi zavorra

    var id: String { rawValue }

    var label: String {
        switch self {
        case .barbell: "Bilanciere"
        case .dumbbell: "Manubri"
        case .machine: "Macchina"
        case .cable: "Cavi"
        case .bodyweight: "Corpo libero"
        }
    }

    /// Etichetta del campo peso, mostrata accanto ai kg durante l'allenamento.
    var weightLabel: String {
        switch self {
        case .barbell: "kg totali"
        case .dumbbell: "kg PER MANUBRIO"
        case .machine, .cable: "kg (o tacca)"
        case .bodyweight: "kg zavorra (0 = nessuna)"
        }
    }
}

/// Gruppo muscolare: serve per proporre le sostituzioni.
enum MuscleGroup: String, Codable, CaseIterable, Identifiable {
    case chest, back, shoulders, rearDelts, biceps, triceps, quads, hamstrings, calves, abs

    var id: String { rawValue }

    var label: String {
        switch self {
        case .chest: "Petto"
        case .back: "Schiena"
        case .shoulders: "Spalle"
        case .rearDelts: "Deltoidi posteriori"
        case .biceps: "Bicipiti"
        case .triceps: "Tricipiti"
        case .quads: "Quadricipiti"
        case .hamstrings: "Femorali"
        case .calves: "Polpacci"
        case .abs: "Addome"
        }
    }
}

/// Giorni della settimana, lunedì = 1 (come in Italia).
enum Weekday: Int, Codable, CaseIterable, Identifiable {
    case monday = 1, tuesday, wednesday, thursday, friday, saturday, sunday

    var id: Int { rawValue }

    var label: String {
        ["Lunedì", "Martedì", "Mercoledì", "Giovedì", "Venerdì", "Sabato", "Domenica"][rawValue - 1]
    }

    var short: String { String(label.prefix(3)).uppercased() }

    /// Giorno di oggi secondo il calendario del telefono.
    static func from(_ date: Date, calendar: Calendar = .current) -> Weekday {
        // Calendar: domenica = 1 ... sabato = 7 → convertiamo a lunedì = 1.
        let w = calendar.component(.weekday, from: date)
        return Weekday(rawValue: w == 1 ? 7 : w - 1)!
    }
}
