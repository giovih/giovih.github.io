import SwiftUI
import SwiftData

/// "Jarvis": chat con l'AI che conosce i tuoi allenamenti, il cibo e il peso.
struct CoachView: View {
    @Environment(\.modelContext) private var context
    @State private var turns: [ClaudeClient.ChatTurn] = []
    @State private var input = ""
    @State private var loading = false
    @State private var error: String?

    private let examples = [
        "Come sta andando la panca?",
        "Quanto ho mangiato questa settimana?",
        "Cosa devo fare oggi in palestra?",
        "Sto salendo di peso abbastanza?",
    ]

    var body: some View {
        NavigationStack {
            ScrollViewReader { proxy in
                ScrollView {
                    VStack(alignment: .leading, spacing: 10) {
                        if turns.isEmpty {
                            Text("Chiedimi qualsiasi cosa sui tuoi allenamenti, sul cibo o sul peso. Guardo i tuoi dati dell'app.")
                                .foregroundStyle(.secondary)
                            ForEach(examples, id: \.self) { q in
                                Button(q) { send(q) }.buttonStyle(.bordered)
                            }
                        }
                        ForEach(turns) { t in
                            Text(t.text)
                                .padding(12)
                                .background(t.fromUser ? Theme.accent.opacity(0.85) : Theme.card,
                                            in: RoundedRectangle(cornerRadius: 16))
                                .frame(maxWidth: .infinity, alignment: t.fromUser ? .trailing : .leading)
                                .id(t.id)
                        }
                        if loading { ProgressView().padding() }
                        if let error { Text("❌ " + error).foregroundStyle(.red) }
                    }
                    .padding()
                }
                .onChange(of: turns) { _, t in
                    if let last = t.last { withAnimation { proxy.scrollTo(last.id, anchor: .bottom) } }
                }
            }
            .safeAreaInset(edge: .bottom) {
                HStack {
                    TextField("Scrivi al coach…", text: $input, axis: .vertical)
                        .lineLimit(1...4)
                        .padding(12).background(Theme.card, in: RoundedRectangle(cornerRadius: 20))
                    Button { send(input) } label: {
                        Image(systemName: "arrow.up.circle.fill").font(.system(size: 36))
                    }
                    .disabled(input.trimmingCharacters(in: .whitespaces).isEmpty || loading)
                }
                .padding(.horizontal).padding(.vertical, 8)
                .background(.bar)
            }
            .navigationTitle("Coach")
            .toolbar {
                if !turns.isEmpty { Button("Nuova") { turns = []; error = nil } }
            }
        }
    }

    private func send(_ text: String) {
        let q = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !q.isEmpty else { return }
        input = ""
        error = nil
        turns.append(.init(fromUser: true, text: q))
        loading = true
        let summary = DataSummary.build(context)
        let history = turns
        Task {
            do {
                let answer = try await ClaudeClient.chat(history: history, dataSummary: summary)
                turns.append(.init(fromUser: false, text: answer))
            } catch {
                self.error = error.localizedDescription
            }
            loading = false
        }
    }
}

/// Riassunto in testo dei dati dell'app, da dare al coach.
enum DataSummary {
    static func build(_ context: ModelContext) -> String {
        var out: [String] = []
        let week = WorkoutService.currentWeek(context)
        out.append("Oggi: \(Format.shortDate(.now)). Settimana \(week.number), ciclo \(week.cycle)/8\(week.isDeload ? " (scarico)" : "").")

        // calendario
        let days = (try? context.fetch(FetchDescriptor<ScheduleDay>(sortBy: [SortDescriptor(\.weekdayRaw)]))) ?? []
        out.append("Calendario: " + days.map { "\($0.weekday.label) \($0.template?.name ?? "riposo")" }.joined(separator: ", "))

        // allenamenti delle ultime 6 settimane
        let since = Calendar.current.date(byAdding: .day, value: -42, to: .now)!
        let sessions = WorkoutService.finishedSessions(context).filter { $0.date >= since }
        out.append("\nALLENAMENTI (ultime 6 settimane, dal più recente):")
        for s in sessions.prefix(24) {
            let ex = s.sortedExercises.filter { !$0.doneSets.isEmpty }.map { e in
                "\(e.name) " + e.doneSets.map { "\(Format.kg($0.kg))x\($0.reps)" }.joined(separator: ",")
            }
            out.append("- \(Format.shortDate(s.date)) \(s.templateName)\(s.isDeload ? " (scarico)" : ""): " + ex.joined(separator: "; "))
        }
        if sessions.isEmpty { out.append("nessuno") }

        // cibo degli ultimi 7 giorni
        out.append("\nCIBO (ultimi 7 giorni):")
        let food = (try? context.fetch(FetchDescriptor<FoodEntry>())) ?? []
        for i in 0..<7 {
            let d = Calendar.current.date(byAdding: .day, value: -i, to: .now)!
            let k = Format.dayKey(d)
            let f = food.filter { $0.day == k }
            if f.isEmpty { continue }
            out.append("- \(k): \(f.reduce(0) { $0 + $1.kcal }) kcal, P \(f.reduce(0) { $0 + $1.protein }) g, C \(f.reduce(0) { $0 + $1.carbs }) g, G \(f.reduce(0) { $0 + $1.fat }) g")
        }
        if let s = WorkoutService.settings(context) {
            out.append("Obiettivi: \(s.kcalMin)-\(s.kcalMax) kcal, proteine ≥\(s.proteinMin) g.")
        }

        // peso
        let weights = (try? context.fetch(FetchDescriptor<BodyWeight>(sortBy: [SortDescriptor(\.date)]))) ?? []
        out.append("\nPESO: partenza 56,1 kg. " + weights.suffix(8).map { "\(Format.dayKey($0.date)) \(Format.kg($0.kg)) kg" }.joined(separator: ", "))

        // acqua e creatina oggi
        let today = Format.dayKey(.now)
        let log = (try? context.fetch(FetchDescriptor<DayLog>(predicate: #Predicate { $0.day == today })))?.first
        out.append("Oggi: acqua \(log?.waterMl ?? 0) ml, creatina \(log?.creatine == true ? "presa" : "non ancora presa").")
        return out.joined(separator: "\n")
    }
}
