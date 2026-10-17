import Foundation
import Observation
import FamilyControls
import ManagedSettings
import DeviceActivity

/// Blocco app con le API Screen Time di Apple.
/// ⚠️ Funziona solo con la capability "Family Controls" (serve l'account sviluppatore a pagamento).
/// Senza, l'app compila lo stesso: la richiesta di autorizzazione fallisce e lo diciamo nell'interfaccia.
@Observable
final class AppBlocker {
    static let shared = AppBlocker()

    /// App Group condiviso con l'estensione delle fasce orarie (cambialo con il tuo).
    static let appGroup = "group.it.giovi.palestra"
    private let defaults = UserDefaults(suiteName: AppBlocker.appGroup) ?? .standard
    private let store = ManagedSettingsStore()

    var selection = FamilyActivitySelection()
    var manualOn = false
    var autoDuringWorkout = true
    var authError: String?
    var schedules: [BlockSchedule] = []

    var isAuthorized: Bool { AuthorizationCenter.shared.authorizationStatus == .approved }

    private init() {
        if let d = defaults.data(forKey: "selection"),
           let s = try? JSONDecoder().decode(FamilyActivitySelection.self, from: d) { selection = s }
        if let d = defaults.data(forKey: "schedules"),
           let s = try? JSONDecoder().decode([BlockSchedule].self, from: d) { schedules = s }
        manualOn = defaults.bool(forKey: "manualOn")
        autoDuringWorkout = defaults.object(forKey: "autoDuringWorkout") as? Bool ?? true
    }

    func requestAuthorization() async {
        do {
            try await AuthorizationCenter.shared.requestAuthorization(for: .individual)
            authError = nil
        } catch {
            authError = "Autorizzazione non riuscita. Serve la capability Family Controls (account sviluppatore a pagamento). Dettaglio: \(error.localizedDescription)"
        }
    }

    func save() {
        defaults.set(try? JSONEncoder().encode(selection), forKey: "selection")
        defaults.set(try? JSONEncoder().encode(schedules), forKey: "schedules")
        defaults.set(manualOn, forKey: "manualOn")
        defaults.set(autoDuringWorkout, forKey: "autoDuringWorkout")
    }

    /// Accende o spegne lo scudo sulle app scelte.
    func apply(workoutActive: Bool) {
        let on = manualOn || (autoDuringWorkout && workoutActive)
        if on && isAuthorized { AppBlocker.shield(selection, store: store) } else { store.clearAllSettings() }
    }

    static func shield(_ sel: FamilyActivitySelection, store: ManagedSettingsStore) {
        store.shield.applications = sel.applicationTokens.isEmpty ? nil : sel.applicationTokens
        store.shield.applicationCategories = sel.categoryTokens.isEmpty ? nil : .specific(sel.categoryTokens)
        store.shield.webDomains = sel.webDomainTokens.isEmpty ? nil : sel.webDomainTokens
    }

    /// Fasce orarie: le gestisce l'estensione DeviceActivityMonitor (vedi cartella EstensioneBlocco).
    func applySchedules() {
        save()
        let center = DeviceActivityCenter()
        center.stopMonitoring()
        for s in schedules where s.enabled {
            let sched = DeviceActivitySchedule(
                intervalStart: DateComponents(hour: s.startHour, minute: s.startMinute),
                intervalEnd: DateComponents(hour: s.endHour, minute: s.endMinute),
                repeats: true)
            try? center.startMonitoring(DeviceActivityName(s.id.uuidString), during: sched)
        }
    }
}

/// Una fascia oraria di blocco (es. studio 15:00-18:00, notte 22:30-7:00).
struct BlockSchedule: Codable, Identifiable, Equatable {
    var id = UUID()
    var name: String
    var startHour: Int
    var startMinute: Int
    var endHour: Int
    var endMinute: Int
    var enabled: Bool = true
}
