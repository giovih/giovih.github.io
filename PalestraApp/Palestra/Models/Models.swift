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
    /// Drop set sull'ultima serie dalla settimana 5.
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

    var setsRepsLabel: String { Format.setsReps(sets, repMin, repMax) }
    var restLabel: String { Format.rest(restMinSec, restMaxSec) }
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

// MARK: - Sedute registrate

/// Un allenamento. Finché `endDate` è nil è quello in corso.
@Model
final class WorkoutSession {
    var date: Date
    var endDate: Date?
    var templateCode: String
    var templateName: String
    var colorHex: String
    var week: Int          // settimana totale (1, 2, 3...)
    var cycleWeek: Int     // 1...8
    var isDeload: Bool
    @Relationship(deleteRule: .cascade, inverse: \SessionExercise.session)
    var exercises: [SessionExercise] = []

    var sortedExercises: [SessionExercise] { exercises.sorted { $0.order < $1.order } }

    init(date: Date, templateCode: String, templateName: String, colorHex: String,
         week: Int, cycleWeek: Int, isDeload: Bool) {
        self.date = date
        self.templateCode = templateCode
        self.templateName = templateName
        self.colorHex = colorHex
        self.week = week
        self.cycleWeek = cycleWeek
        self.isDeload = isDeload
    }
}

/// Un esercizio dentro una seduta (copia della riga di scheda, così le modifiche alla scheda non cambiano lo storico).
@Model
final class SessionExercise {
    var session: WorkoutSession?
    var order: Int
    var name: String
    var equipmentRaw: String
    var repMin: Int
    var repMax: Int
    var restMinSec: Int
    var restMaxSec: Int
    var supersetGroup: Int?
    var dropSet: Bool
    var cleanTechnique: Bool = true
    /// Consiglio della doppia progressione per oggi.
    var hint: String
    @Relationship(deleteRule: .cascade, inverse: \SetLog.exercise)
    var sets: [SetLog] = []

    var equipment: Equipment { Equipment(rawValue: equipmentRaw) ?? .machine }
    var sortedSets: [SetLog] { sets.sorted { $0.index < $1.index } }
    var doneSets: [SetLog] { sortedSets.filter { $0.done && $0.reps > 0 } }

    init(order: Int, name: String, equipment: Equipment, repMin: Int, repMax: Int,
         restMinSec: Int, restMaxSec: Int, supersetGroup: Int?, dropSet: Bool, hint: String) {
        self.order = order
        self.name = name
        self.equipmentRaw = equipment.rawValue
        self.repMin = repMin
        self.repMax = repMax
        self.restMinSec = restMinSec
        self.restMaxSec = restMaxSec
        self.supersetGroup = supersetGroup
        self.dropSet = dropSet
        self.hint = hint
    }
}

/// Una serie di lavoro (niente riscaldamento, niente parte drop).
@Model
final class SetLog {
    var exercise: SessionExercise?
    var index: Int
    var kg: Double
    var reps: Int
    var done: Bool

    init(index: Int, kg: Double, reps: Int, done: Bool = false) {
        self.index = index
        self.kg = kg
        self.reps = reps
        self.done = done
    }
}

/// Diario ogni 4 settimane (settimane 1, 4, 8, 12...).
@Model
final class DiaryEntry {
    var date: Date
    var week: Int
    var bodyKg: Double
    var bench: String
    var squat: String
    var row: String
    var notes: String

    init(date: Date, week: Int, bodyKg: Double, bench: String, squat: String, row: String, notes: String) {
        self.date = date
        self.week = week
        self.bodyKg = bodyKg
        self.bench = bench
        self.squat = squat
        self.row = row
        self.notes = notes
    }
}

// MARK: - Cibo, acqua, creatina, peso

enum Meal: String, Codable, CaseIterable, Identifiable {
    case colazione, spuntino, pranzo, merenda, cena, notte
    var id: String { rawValue }
    var label: String {
        switch self {
        case .colazione: "Colazione"
        case .spuntino: "Spuntino a scuola"
        case .pranzo: "Pranzo · pre-allenamento (1-1,5 h prima)"
        case .merenda: "Merenda · post-allenamento"
        case .cena: "Cena"
        case .notte: "Prima di dormire"
        }
    }
    var icon: String {
        switch self {
        case .colazione: "🥣"
        case .spuntino: "🍎"
        case .pranzo: "🍝"
        case .merenda: "🥛"
        case .cena: "🍽️"
        case .notte: "🌙"
        }
    }
}

/// Un cibo mangiato.
@Model
final class FoodEntry {
    var day: String          // "2026-10-17"
    var mealRaw: String
    var createdAt: Date
    var text: String
    var kcal: Int
    var protein: Int
    var carbs: Int
    var fat: Int
    @Attribute(.externalStorage) var photo: Data?

    var meal: Meal { Meal(rawValue: mealRaw) ?? .pranzo }

    init(day: String, meal: Meal, text: String, kcal: Int, protein: Int, carbs: Int, fat: Int, photo: Data?) {
        self.day = day
        self.mealRaw = meal.rawValue
        self.createdAt = .now
        self.text = text
        self.kcal = kcal
        self.protein = protein
        self.carbs = carbs
        self.fat = fat
        self.photo = photo
    }
}

/// Acqua e creatina di un giorno.
@Model
final class DayLog {
    @Attribute(.unique) var day: String
    var waterMl: Int
    var creatine: Bool

    init(day: String) {
        self.day = day
        self.waterMl = 0
        self.creatine = false
    }
}

/// Peso corporeo (una volta a settimana, mattina a digiuno).
@Model
final class BodyWeight {
    var date: Date
    var kg: Double

    init(date: Date, kg: Double) {
        self.date = date
        self.kg = kg
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
    var carbsTarget: Int
    var fatTarget: Int

    init(programStart: Date) {
        self.programStart = programStart
        self.heightCm = 172
        self.startWeightKg = 56.1
        self.kcalMin = 3000
        self.kcalMax = 3300
        self.proteinMin = 120
        self.carbsTarget = 400
        self.fatTarget = 85
    }
}

/// Tutti i modelli, per creare il database.
let allModels: [any PersistentModel.Type] = [
    Exercise.self, WorkoutTemplate.self, TemplateItem.self, ScheduleDay.self,
    WorkoutSession.self, SessionExercise.self, SetLog.self, DiaryEntry.self,
    FoodEntry.self, DayLog.self, BodyWeight.self, AppSettings.self,
]
