import Foundation
import SwiftData

// MARK: - Esercizio

/// Un esercizio del catalogo (precaricato o creato da te).
@Model
final class Exercise {
    @Attribute(.unique) var name: String
    var muscleRaw: String
    var equipmentRaw: String
    var isCustom: Bool

    var muscle: MuscleGroup {
        get { MuscleGroup(rawValue: muscleRaw) ?? .chest }
        set { muscleRaw = newValue.rawValue }
    }
    var equipment: Equipment {
        get { Equipment(rawValue: equipmentRaw) ?? .machine }
        set { equipmentRaw = newValue.rawValue }
    }

    init(name: String, muscle: MuscleGroup, equipment: Equipment, isCustom: Bool = false) {
        self.name = name
        self.muscleRaw = muscle.rawValue
        self.equipmentRaw = equipment.rawValue
        self.isCustom = isCustom
    }
}

// MARK: - Scheda (template di allenamento)

/// Una seduta della scheda: Upper A, Upper B, Gambe, Upper C.
@Model
final class WorkoutTemplate {
    @Attribute(.unique) var code: String   // "A", "B", "G", "C"
    var name: String                       // "Upper A"
    var subtitle: String                   // "Forza petto/schiena"
    var colorHex: String
    var order: Int
    @Relationship(deleteRule: .cascade, inverse: \TemplateItem.template)
    var items: [TemplateItem] = []

    var sortedItems: [TemplateItem] { items.sorted { $0.order < $1.order } }

    init(code: String, name: String, subtitle: String, colorHex: String, order: Int) {
        self.code = code
        self.name = name
        self.subtitle = subtitle
        self.colorHex = colorHex
        self.order = order
    }
}

/// Una riga della scheda: esercizio + serie x ripetizioni + recupero.
@Model
final class TemplateItem {
    var order: Int
    var exercise: Exercise?
    var template: WorkoutTemplate?
    var sets: Int
    var repMin: Int
    var repMax: Int
    var restMinSec: Int       // es. 120 per "2-3 min"
    var restMaxSec: Int       // es. 180
    /// Stesso numero = stessa superserie (si fanno di fila, recupero a fine coppia).
    var supersetGroup: Int?
    /// Drop set sull'ultima serie a partire dalla settimana 5.
    var dropSet: Bool

    init(order: Int, exercise: Exercise, sets: Int, repMin: Int, repMax: Int,
         restMinSec: Int, restMaxSec: Int, supersetGroup: Int? = nil, dropSet: Bool = false) {
        self.order = order
        self.exercise = exercise
        self.sets = sets
        self.repMin = repMin
        self.repMax = repMax
        self.restMinSec = restMinSec
        self.restMaxSec = restMaxSec
        self.supersetGroup = supersetGroup
        self.dropSet = dropSet
    }

    /// "4 x 6-8" oppure "3 x 15".
    var setsRepsLabel: String {
        repMin == repMax ? "\(sets) x \(repMin)" : "\(sets) x \(repMin)-\(repMax)"
    }

    /// "2-3 min", "90 s", "60-90 s".
    var restLabel: String { Self.formatRest(restMinSec, restMaxSec) }

    static func formatRest(_ a: Int, _ b: Int) -> String {
        if a >= 120 && a % 60 == 0 && b % 60 == 0 {
            return a == b ? "\(a / 60) min" : "\(a / 60)-\(b / 60) min"
        }
        return a == b ? "\(a) s" : "\(a)-\(b) s"
    }
}

// MARK: - Calendario

/// Cosa si fa in un giorno della settimana (nil = riposo). Modificabile.
@Model
final class ScheduleDay {
    @Attribute(.unique) var weekdayRaw: Int
    var template: WorkoutTemplate?

    var weekday: Weekday { Weekday(rawValue: weekdayRaw) ?? .monday }

    init(weekday: Weekday, template: WorkoutTemplate?) {
        self.weekdayRaw = weekday.rawValue
        self.template = template
    }
}

// MARK: - Sedute registrate (usate dallo step 2)

/// Un allenamento fatto davvero.
@Model
final class WorkoutSession {
    var date: Date
    var endDate: Date?
    var templateCode: String
    var templateName: String
    /// Settimana del ciclo (1-8) in cui è stata fatta.
    var cycleWeek: Int
    var notes: String = ""
    @Relationship(deleteRule: .cascade, inverse: \SetLog.session)
    var sets: [SetLog] = []

    init(date: Date, templateCode: String, templateName: String, cycleWeek: Int) {
        self.date = date
        self.templateCode = templateCode
        self.templateName = templateName
        self.cycleWeek = cycleWeek
    }
}

/// Una serie registrata (solo serie di lavoro: niente riscaldamento, niente drop).
@Model
final class SetLog {
    var session: WorkoutSession?
    var exerciseName: String       // salvato come testo: lo storico resta anche se rinomini
    var itemOrder: Int             // posizione nella seduta
    var setIndex: Int              // 0, 1, 2...
    var kg: Double
    var reps: Int
    var completed: Bool

    init(exerciseName: String, itemOrder: Int, setIndex: Int, kg: Double = 0, reps: Int = 0, completed: Bool = false) {
        self.exerciseName = exerciseName
        self.itemOrder = itemOrder
        self.setIndex = setIndex
        self.kg = kg
        self.reps = reps
        self.completed = completed
    }
}

// MARK: - Impostazioni

/// Impostazioni generali (una sola riga nel database).
@Model
final class AppSettings {
    /// Lunedì della settimana 1 del ciclo.
    var programStart: Date
    var heightCm: Double
    var startWeightKg: Double
    var kcalMin: Int
    var kcalMax: Int
    var proteinMin: Int

    init(programStart: Date) {
        self.programStart = programStart
        self.heightCm = 172
        self.startWeightKg = 56.1
        self.kcalMin = 3000
        self.kcalMax = 3300
        self.proteinMin = 120
    }
}
