import Foundation

/// Una serie fatta in passato.
struct PerformedSet: Equatable {
    let kg: Double
    let reps: Int
}

/// Un esercizio fatto in una seduta passata (solo serie completate).
struct PastPerformance: Equatable {
    let date: Date
    let sets: [PerformedSet]
    let clean: Bool

    var totalReps: Int { sets.reduce(0) { $0 + $1.reps } }
    var topKg: Double { sets.first?.kg ?? 0 }
}

/// Cosa fare oggi per un esercizio.
struct Suggestion: Equatable {
    var kg: Double?
    var reps: [Int]
    var message: String
}

/// Doppia progressione della scheda.
enum Progression {

    /// Di quanto si sale quando si fa il massimo in tutte le serie.
    static func increment(for eq: Equipment) -> Double {
        switch eq {
        case .barbell: 2.5      // 1,25 per lato
        case .dumbbell: 2       // per manubrio (1 se ci sono i manubri intermedi)
        case .machine, .cable: 2.5  // circa una tacca
        case .bodyweight: 2.5   // zavorra
        }
    }

    static func incrementText(for eq: Equipment) -> String {
        switch eq {
        case .barbell: "+2,5 kg (1,25 per lato)"
        case .dumbbell: "+1-2 kg per manubrio"
        case .machine, .cable: "+1 tacca"
        case .bodyweight: "aggiungi zavorra 1-2,5 kg"
        }
    }

    static func round(_ kg: Double, step: Double = 0.5) -> Double {
        (kg / step).rounded() * step
    }

    /// - Parameter history: sedute normali (non di scarico), dalla più recente.
    static func suggest(sets: Int, repMin: Int, repMax: Int, equipment: Equipment,
                        history: [PastPerformance], deload: Bool) -> Suggestion {
        var s = Suggestion(kg: nil, reps: Array(repeating: repMin, count: sets),
                           message: "Prima volta: scegli un peso con cui fai \(repMin) ripetizioni pulite.")

        if let last = history.first {
            let kg = last.topKg
            let allMax = last.sets.count >= sets && last.sets.allSatisfy { $0.reps >= repMax } && last.clean
            let stalled = history.count >= 3
                && history.prefix(3).allSatisfy { $0.topKg == kg }
                && history[0].totalReps <= history[2].totalReps

            if allMax {
                s.kg = kg + increment(for: equipment)
                s.message = "Massimo in tutte le serie 💪 Sali di peso (\(incrementText(for: equipment))) e riparti da \(repMin)."
            } else if stalled && kg > 0 {
                s.kg = round(kg * 0.9)
                s.message = "Fermo da 3 sedute: scendi del 10% (\(Format.kg(s.kg!)) kg) e risali."
            } else {
                s.kg = kg
                s.reps = (0..<sets).map { i in
                    let prev = i < last.sets.count ? last.sets[i].reps : (last.sets.last?.reps ?? repMin - 1)
                    return min(prev + 1, repMax)
                }
                let improved = history.count < 2 || history[0].totalReps > history[1].totalReps
                s.message = improved
                    ? "Stesso peso, +1 ripetizione per serie."
                    : "L'ultima volta non hai aggiunto ripetizioni: stesso peso, riprova +1."
                if equipment == .bodyweight && kg == 0 {
                    s.message += " Quando fai il massimo in tutte le serie si aggiunge zavorra."
                }
            }
        }

        if deload {
            if let kg = s.kg { s.kg = round(kg * 0.9) }
            s.reps = Array(s.reps.prefix(Int((Double(sets) / 2).rounded(.up))))
            s.message = "Settimana di scarico: metà serie e -10% di peso. " + s.message
        }
        return s
    }
}
