import DeviceActivity
import FamilyControls
import ManagedSettings
import Foundation

/// Estensione "Device Activity Monitor": iOS la sveglia all'inizio e alla fine di ogni fascia oraria,
/// anche ad app chiusa. Va in un target separato (vedi LEGGIMI.md), solo con l'account sviluppatore.
final class BloccoMonitor: DeviceActivityMonitor {
    /// Deve essere uguale a AppBlocker.appGroup nell'app.
    private let defaults = UserDefaults(suiteName: "group.it.giovi.palestra")
    private let store = ManagedSettingsStore(named: ManagedSettingsStore.Name("fasce"))

    override func intervalDidStart(for activity: DeviceActivityName) {
        super.intervalDidStart(for: activity)
        guard let data = defaults?.data(forKey: "selection"),
              let sel = try? JSONDecoder().decode(FamilyActivitySelection.self, from: data) else { return }
        store.shield.applications = sel.applicationTokens.isEmpty ? nil : sel.applicationTokens
        store.shield.applicationCategories = sel.categoryTokens.isEmpty ? nil : .specific(sel.categoryTokens)
        store.shield.webDomains = sel.webDomainTokens.isEmpty ? nil : sel.webDomainTokens
    }

    override func intervalDidEnd(for activity: DeviceActivityName) {
        super.intervalDidEnd(for: activity)
        store.clearAllSettings()
    }
}
