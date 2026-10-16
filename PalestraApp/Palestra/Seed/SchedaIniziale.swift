import Foundation
import SwiftData

/// Precarica la scheda cartacea al primo avvio. Non fa nulla se i dati esistono già.
enum SchedaIniziale {

    // MARK: Catalogo esercizi (scheda + alternative per le sostituzioni)

    private static let catalogo: [(String, MuscleGroup, Equipment)] = [
        // Petto
        ("Panca piana", .chest, .barbell),
        ("Panca inclinata manubri", .chest, .dumbbell),
        ("Croci ai cavi", .chest, .cable),
        ("Panca piana manubri", .chest, .dumbbell),
        ("Panca inclinata bilanciere", .chest, .barbell),
        ("Chest press", .chest, .machine),
        ("Pec deck", .chest, .machine),
        ("Croci manubri", .chest, .dumbbell),
        // Schiena
        ("Rematore con bilanciere", .back, .barbell),
        ("Trazioni", .back, .bodyweight),
        ("Lat machine presa larga", .back, .cable),
        ("Rematore al cavo basso", .back, .cable),
        ("Rematore manubrio", .back, .dumbbell),
        ("Rematore alla macchina", .back, .machine),
        ("Lat machine presa stretta", .back, .cable),
        ("Trazioni assistite", .back, .machine),
        // Spalle
        ("Military press manubri", .shoulders, .dumbbell),
        ("Military press bilanciere", .shoulders, .barbell),
        ("Alzate laterali", .shoulders, .dumbbell),
        ("Shoulder press macchina", .shoulders, .machine),
        ("Alzate laterali ai cavi", .shoulders, .cable),
        // Deltoidi posteriori
        ("Face pull", .rearDelts, .cable),
        ("Alzate posteriori (reverse pec deck)", .rearDelts, .machine),
        ("Alzate posteriori manubri", .rearDelts, .dumbbell),
        // Bicipiti
        ("Curl EZ", .biceps, .barbell),
        ("Curl inclinato manubri", .biceps, .dumbbell),
        ("Curl a martello", .biceps, .dumbbell),
        ("Curl ai cavi", .biceps, .cable),
        ("Curl manubri", .biceps, .dumbbell),
        // Tricipiti
        ("French press", .triceps, .barbell),
        ("Dip alle parallele", .triceps, .bodyweight),
        ("Panca presa stretta", .triceps, .barbell),
        ("Estensione tricipiti sopra la testa", .triceps, .cable),
        ("Pushdown ai cavi", .triceps, .cable),
        // Gambe
        ("Squat", .quads, .barbell),
        ("Leg press", .quads, .machine),
        ("Hack squat", .quads, .machine),
        ("Affondi manubri", .quads, .dumbbell),
        ("Leg extension", .quads, .machine),
        ("Stacco rumeno", .hamstrings, .barbell),
        ("Leg curl", .hamstrings, .machine),
        ("Stacco rumeno manubri", .hamstrings, .dumbbell),
        ("Calf raise in piedi", .calves, .machine),
        ("Calf raise alla leg press", .calves, .machine),
        // Addome
        ("Hanging leg raise", .abs, .bodyweight),
        ("Crunch ai cavi", .abs, .cable),
    ]

    // MARK: Righe della scheda

    /// (esercizio, serie, rip min, rip max, rec min s, rec max s, superserie, drop set)
    private typealias Riga = (String, Int, Int, Int, Int, Int, Int?, Bool)

    private static let upperA: [Riga] = [
        ("Panca piana", 4, 6, 8, 120, 180, nil, false),
        ("Rematore con bilanciere", 4, 6, 8, 120, 180, nil, false),
        ("Military press manubri", 3, 8, 10, 120, 120, nil, false),
        ("Trazioni", 3, 6, 10, 120, 120, nil, false),
        ("Curl EZ", 3, 8, 10, 90, 90, 1, false),
        ("French press", 3, 8, 10, 90, 90, 1, false),
    ]

    private static let upperB: [Riga] = [
        ("Panca inclinata manubri", 4, 8, 10, 120, 120, nil, false),
        ("Lat machine presa larga", 4, 8, 10, 120, 120, nil, false),
        ("Croci ai cavi", 3, 12, 15, 60, 90, nil, true),
        ("Rematore al cavo basso", 3, 10, 12, 90, 90, nil, false),
        ("Alzate laterali", 3, 12, 15, 60, 60, nil, true),
        ("Face pull", 3, 15, 15, 60, 60, nil, false),
    ]

    private static let gambe: [Riga] = [
        ("Squat", 4, 6, 8, 180, 180, nil, false),
        ("Stacco rumeno", 3, 8, 10, 120, 180, nil, false),
        ("Leg press", 2, 10, 12, 120, 120, nil, false),
        ("Leg curl", 2, 10, 12, 90, 90, nil, false),
        ("Calf raise in piedi", 3, 12, 15, 60, 60, nil, false),
        ("Hanging leg raise", 3, 10, 15, 60, 60, nil, false),
    ]

    private static let upperC: [Riga] = [
        ("Military press bilanciere", 4, 6, 8, 120, 180, nil, false),
        ("Alzate laterali", 4, 12, 15, 60, 60, nil, true),
        ("Alzate posteriori (reverse pec deck)", 3, 15, 15, 60, 60, nil, false),
        ("Dip alle parallele", 3, 8, 12, 120, 120, nil, false),
        ("Curl inclinato manubri", 3, 10, 12, 90, 90, nil, true),
        ("Curl a martello", 3, 10, 12, 90, 90, 1, false),
        ("Estensione tricipiti sopra la testa", 3, 10, 12, 90, 90, 1, false),
    ]

    // MARK: Caricamento

    static func populateIfNeeded(_ context: ModelContext) {
        let count = (try? context.fetchCount(FetchDescriptor<WorkoutTemplate>())) ?? 0
        guard count == 0 else { return }

        // 1. Esercizi
        var byName: [String: Exercise] = [:]
        for (name, muscle, eq) in catalogo {
            let ex = Exercise(name: name, muscle: muscle, equipment: eq)
            context.insert(ex)
            byName[name] = ex
        }

        // 2. Sedute
        func make(_ code: String, _ name: String, _ sub: String, _ color: String, _ order: Int, _ righe: [Riga]) -> WorkoutTemplate {
            let t = WorkoutTemplate(code: code, name: name, subtitle: sub, colorHex: color, order: order)
            context.insert(t)
            for (i, r) in righe.enumerated() {
                guard let ex = byName[r.0] else { assertionFailure("Esercizio mancante: \(r.0)"); continue }
                let item = TemplateItem(order: i, exercise: ex, sets: r.1, repMin: r.2, repMax: r.3,
                                        restMinSec: r.4, restMaxSec: r.5, supersetGroup: r.6, dropSet: r.7)
                item.template = t
                context.insert(item)
            }
            return t
        }
        let a = make("A", "Upper A", "Forza petto/schiena", "EA580C", 0, upperA)
        let b = make("B", "Upper B", "Volume petto/schiena", "2563EB", 1, upperB)
        let g = make("G", "Gambe", "Compatta", "16A34A", 2, gambe)
        let c = make("C", "Upper C", "Spalle e braccia", "9333EA", 3, upperC)

        // 3. Calendario: lun A, mer B, ven Gambe, sab C, resto riposo
        let plan: [Weekday: WorkoutTemplate?] = [
            .monday: a, .tuesday: nil, .wednesday: b, .thursday: nil,
            .friday: g, .saturday: c, .sunday: nil,
        ]
        for day in Weekday.allCases {
            context.insert(ScheduleDay(weekday: day, template: plan[day] ?? nil))
        }

        // 4. Impostazioni: la settimana 1 parte dal lunedì di questa settimana
        context.insert(AppSettings(programStart: Calendar.italian.startOfWeek(for: .now)))

        try? context.save()
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
