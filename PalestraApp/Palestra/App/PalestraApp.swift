import SwiftUI
import SwiftData
import UserNotifications

@main
struct PalestraApp: App {
    /// Database locale (tutto resta sul telefono).
    let container: ModelContainer = {
        do {
            return try ModelContainer(for: Schema(allModels))
        } catch {
            fatalError("Impossibile aprire il database: \(error)")
        }
    }()

    init() {
        SchedaIniziale.populateIfNeeded(container.mainContext)
        UNUserNotificationCenter.current().delegate = NotificationDelegate.shared
        Notifiche.requestPermission()
        Notifiche.scheduleDailyReminders()
    }

    var body: some Scene {
        WindowGroup {
            ContentView()
                .preferredColorScheme(.dark)
                .tint(Theme.accent)
        }
        .modelContainer(container)
    }
}

/// Tab principali.
struct ContentView: View {
    @Query(filter: #Predicate<WorkoutSession> { $0.endDate == nil }) private var active: [WorkoutSession]
    /// Allenamento mostrato a tutto schermo.
    @State private var workout: WorkoutSession?

    var body: some View {
        TabView {
            HomeView(workout: $workout)
                .tabItem { Label("Oggi", systemImage: "house.fill") }
            CiboView()
                .tabItem { Label("Cibo", systemImage: "fork.knife") }
            StoricoView()
                .tabItem { Label("Storico", systemImage: "chart.xyaxis.line") }
            CoachView()
                .tabItem { Label("Coach", systemImage: "bubble.left.and.text.bubble.right.fill") }
            AltroView()
                .tabItem { Label("Altro", systemImage: "gearshape.fill") }
        }
        .fullScreenCover(item: $workout) { s in
            WorkoutView(session: s) { workout = nil }
        }
        .onAppear {
            // se l'app era stata chiusa durante un allenamento, lo riapre
            workout = active.first
            AppBlocker.shared.apply(workoutActive: !active.isEmpty)
        }
    }
}

/// Colori e stili comuni.
enum Theme {
    static let accent = Color(hex: "F97316")
    static let card = Color(hex: "1A2232")
    static let row = Color(hex: "222C3D")
    static let green = Color(hex: "16A34A")
    static let yellow = Color(hex: "FACC15")
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

/// Bottone grande, facile da premere con una mano.
struct BigButtonStyle: ButtonStyle {
    var color: Color = Theme.accent
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.title3.bold())
            .foregroundStyle(.white)
            .frame(maxWidth: .infinity, minHeight: 60)
            .background(color.opacity(configuration.isPressed ? 0.7 : 1), in: RoundedRectangle(cornerRadius: 18))
    }
}

/// Barra di avanzamento colorata con titolo e valori.
struct ProgressRow: View {
    let title: String
    let value: Double
    let target: Double
    let label: String
    let color: Color

    var body: some View {
        VStack(spacing: 4) {
            HStack {
                Text(title).bold()
                Spacer()
                Text(label).foregroundStyle(.secondary).monospacedDigit()
            }
            .font(.subheadline)
            ProgressView(value: min(value, target), total: max(target, 1))
                .tint(color)
                .scaleEffect(x: 1, y: 2, anchor: .center)
        }
    }
}
