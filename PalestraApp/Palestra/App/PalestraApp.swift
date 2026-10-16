import SwiftUI
import SwiftData

@main
struct PalestraApp: App {
    /// Database locale (tutto resta sul telefono).
    let container: ModelContainer = {
        let schema = Schema([
            Exercise.self, WorkoutTemplate.self, TemplateItem.self, ScheduleDay.self,
            WorkoutSession.self, SetLog.self, AppSettings.self,
        ])
        do {
            return try ModelContainer(for: schema)
        } catch {
            fatalError("Impossibile aprire il database: \(error)")
        }
    }()

    init() {
        SchedaIniziale.populateIfNeeded(container.mainContext)
    }

    var body: some Scene {
        WindowGroup {
            ContentView()
                .preferredColorScheme(.dark)
                .tint(.orange)
        }
        .modelContainer(container)
    }
}

/// Tab principali. Gli altri tab arrivano negli step successivi.
struct ContentView: View {
    var body: some View {
        TabView {
            SchedaView()
                .tabItem { Label("Scheda", systemImage: "list.bullet.rectangle") }
        }
    }
}

extension Color {
    /// Colore da stringa esadecimale, es. "EA580C".
    init(hex: String) {
        let v = UInt64(hex, radix: 16) ?? 0x888888
        self.init(red: Double((v >> 16) & 0xFF) / 255,
                  green: Double((v >> 8) & 0xFF) / 255,
                  blue: Double(v & 0xFF) / 255)
    }
}
