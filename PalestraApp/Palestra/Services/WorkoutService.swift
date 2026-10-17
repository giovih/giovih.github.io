import Foundation
import SwiftData

/// Avvio, storico e progressione degli allenamenti.
enum WorkoutService {

    static func settings(_ context: ModelContext) -> AppSettings? {
        try? context.fetch(FetchDescriptor<AppSettings>()).first
    }

    static func currentWeek(_ context: ModelContext, now: Date = .now) -> ProgramWeek {
        ProgramWeek.current(start: settings(context)?.programStart ?? now, now: now)
    }

    /// Sedute finite, dalla più recente.
    static func finishedSessions(_ context: ModelContext) -> [WorkoutSession] {
        let d = FetchDescriptor<WorkoutSession>(predicate: #Predicate { $0.endDate != nil },
                                                sortBy: [SortDescriptor(\.date, order: .reverse)])
        return (try? context.fetch(d)) ?? []
    }

    /// Storico di un esercizio per la progressione: niente sedute di scarico
    /// (dopo lo scarico si riparte dai pesi di prima).
    static func history(of name: String, in sessions: [WorkoutSession]) -> [PastPerformance] {
        sessions.compactMap { s -> PastPerformance? in
            guard !s.isDeload, let ex = s.exercises.first(where: { $0.name == name }) else { return nil }
            let sets = ex.doneSets.map { PerformedSet(kg: $0.kg, reps: $0.reps) }
            return sets.isEmpty ? nil : PastPerformance(date: s.date, sets: sets, clean: ex.cleanTechnique)
        }
    }

    /// Ultima volta in assoluto (anche scarico), per il testo "Ultima volta".
    static func lastTime(of name: String, in sessions: [WorkoutSession]) -> [PerformedSet]? {
        for s in sessions {
            if let ex = s.exercises.first(where: { $0.name == name }), !ex.doneSets.isEmpty {
                return ex.doneSets.map { PerformedSet(kg: $0.kg, reps: $0.reps) }
            }
        }
        return nil
    }

    /// Crea l'allenamento di oggi con serie già compilate secondo la progressione.
    @discardableResult
    static func start(_ template: WorkoutTemplate, context: ModelContext) -> WorkoutSession {
        let week = currentWeek(context)
        let past = finishedSessions(context)
        let session = WorkoutSession(date: .now, templateCode: template.code, templateName: template.name,
                                     colorHex: template.colorHex, week: week.number,
                                     cycleWeek: week.cycle, isDeload: week.isDeload)
        context.insert(session)
        for item in template.sortedItems {
            guard let ex = item.exercise else { continue }
            let se = SessionExercise(order: item.order, name: ex.name, equipment: ex.equipment,
                                     repMin: item.repMin, repMax: item.repMax,
                                     restMinSec: item.restMinSec, restMaxSec: item.restMaxSec,
                                     supersetGroup: item.supersetGroup, dropSet: item.dropSet, hint: "")
            se.session = session
            context.insert(se)
            fill(se, sets: item.sets, past: past, deload: week.isDeload, context: context)
        }
        try? context.save()
        return session
    }

    /// Compila consiglio e serie di un esercizio (usato anche dopo una sostituzione).
    static func fill(_ se: SessionExercise, sets: Int, past: [WorkoutSession], deload: Bool, context: ModelContext) {
        let sug = Progression.suggest(sets: sets, repMin: se.repMin, repMax: se.repMax, equipment: se.equipment,
                                      history: history(of: se.name, in: past), deload: deload)
        se.hint = sug.message
        for old in se.sets { context.delete(old) }
        se.sets = []
        for (i, r) in sug.reps.enumerated() {
            let set = SetLog(index: i, kg: sug.kg ?? 0, reps: r)
            set.exercise = se
            context.insert(set)
        }
    }

    /// Cambia esercizio (macchina occupata) mantenendo serie, ripetizioni e recupero.
    static func substitute(_ se: SessionExercise, with ex: Exercise, context: ModelContext) {
        let count = se.sets.count
        se.name = ex.name
        se.equipmentRaw = ex.equipment.rawValue
        fill(se, sets: count, past: finishedSessions(context), deload: se.session?.isDeload ?? false, context: context)
        try? context.save()
    }

    /// Chiude l'allenamento. Se non c'è nessuna serie spuntata lo cancella.
    /// - Returns: true se è stato salvato.
    @discardableResult
    static func finish(_ s: WorkoutSession, context: ModelContext) -> Bool {
        RestTimer.shared.stop()
        let any = s.exercises.contains { !$0.doneSets.isEmpty }
        if any {
            s.endDate = .now
            // nello storico restano solo le serie fatte
            for ex in s.exercises { for set in ex.sets where !set.done { context.delete(set) } }
        } else {
            context.delete(s)
        }
        try? context.save()
        return any
    }
}
