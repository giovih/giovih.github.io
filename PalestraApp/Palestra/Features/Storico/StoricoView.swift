import SwiftUI
import SwiftData
import Charts

/// Storico: grafici per esercizio, elenco allenamenti, diario ogni 4 settimane.
struct StoricoView: View {
    @Environment(\.modelContext) private var context
    @Query(filter: #Predicate<WorkoutSession> { $0.endDate != nil }, sort: \WorkoutSession.date, order: .reverse)
    private var sessions: [WorkoutSession]
    @State private var selected = ""
    @State private var tab = 0

    private var names: [String] {
        var seen = Set<String>(), out: [String] = []
        for s in sessions { for e in s.sortedExercises where !e.doneSets.isEmpty && seen.insert(e.name).inserted { out.append(e.name) } }
        return out
    }

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                Picker("", selection: $tab) {
                    Text("Grafici").tag(0)
                    Text("Allenamenti").tag(1)
                    Text("Diario").tag(2)
                }
                .pickerStyle(.segmented).padding()

                switch tab {
                case 0: charts
                case 1: list
                default: DiaryView()
                }
            }
            .navigationTitle("Storico")
        }
    }

    // MARK: Grafici

    private struct Point: Identifiable {
        let id = UUID()
        let date: Date
        let kg: Double
        let reps: Int
    }

    private var charts: some View {
        ScrollView {
            if names.isEmpty {
                ContentUnavailableView("Ancora niente", systemImage: "dumbbell",
                                       description: Text("Fai il primo allenamento!"))
            } else {
                let name = names.contains(selected) ? selected : names[0]
                let points: [Point] = sessions.reversed().compactMap { s -> Point? in
                    guard let e = s.exercises.first(where: { $0.name == name }), !e.doneSets.isEmpty else { return nil }
                    return Point(date: s.date, kg: e.doneSets.map(\.kg).max() ?? 0,
                                 reps: e.doneSets.reduce(0) { $0 + $1.reps })
                }
                VStack(alignment: .leading, spacing: 16) {
                    Picker("Esercizio", selection: Binding(get: { name }, set: { selected = $0 })) {
                        ForEach(names, id: \.self) { Text($0).tag($0) }
                    }
                    .pickerStyle(.menu)

                    chartBox("Peso migliore (kg)", color: Theme.accent) {
                        Chart(points) {
                            LineMark(x: .value("Data", $0.date), y: .value("kg", $0.kg))
                            PointMark(x: .value("Data", $0.date), y: .value("kg", $0.kg))
                        }
                        .foregroundStyle(Theme.accent)
                        .chartYScale(domain: .automatic(includesZero: false))
                    }
                    chartBox("Ripetizioni totali", color: .blue) {
                        Chart(points) {
                            LineMark(x: .value("Data", $0.date), y: .value("Ripetizioni", $0.reps))
                            PointMark(x: .value("Data", $0.date), y: .value("Ripetizioni", $0.reps))
                        }
                        .foregroundStyle(.blue)
                        .chartYScale(domain: .automatic(includesZero: false))
                    }
                }
                .padding()
            }
        }
    }

    private func chartBox<C: View>(_ title: String, color: Color, @ViewBuilder chart: () -> C) -> some View {
        VStack(alignment: .leading) {
            Text(title).font(.headline)
            chart().frame(height: 180)
        }
        .padding().background(Theme.card, in: RoundedRectangle(cornerRadius: 16))
    }

    // MARK: Elenco

    private var list: some View {
        List {
            ForEach(sessions) { s in
                DisclosureGroup {
                    ForEach(s.sortedExercises.filter { !$0.doneSets.isEmpty }) { e in
                        VStack(alignment: .leading) {
                            Text(e.name).bold()
                            Text(e.doneSets.map { "\(Format.kg($0.kg))×\($0.reps)" }.joined(separator: " · "))
                                .font(.callout).foregroundStyle(.secondary)
                        }
                    }
                } label: {
                    HStack {
                        Circle().fill(Color(hex: s.colorHex)).frame(width: 10)
                        Text(Format.shortDate(s.date))
                        Text(s.templateName).bold()
                        if s.isDeload { Text("scarico").font(.caption).foregroundStyle(.secondary) }
                    }
                }
            }
            .onDelete { idx in
                for i in idx { context.delete(sessions[i]) }
                try? context.save()
            }
        }
    }
}

/// Diario ogni 4 settimane: peso corporeo, panca, squat, rematore, note.
struct DiaryView: View {
    @Environment(\.modelContext) private var context
    @Query(sort: \DiaryEntry.date, order: .reverse) private var entries: [DiaryEntry]
    @Query(sort: \BodyWeight.date, order: .reverse) private var weights: [BodyWeight]
    @Query(filter: #Predicate<WorkoutSession> { $0.endDate != nil }, sort: \WorkoutSession.date, order: .reverse)
    private var sessions: [WorkoutSession]
    @State private var adding = false

    var body: some View {
        List {
            Section {
                Button("+ Nuova voce del diario") { adding = true }
            } footer: {
                Text("Settimane 1, 4, 8, 12... Le serie migliori vengono compilate da sole dallo storico.")
            }
            ForEach(entries) { e in
                VStack(alignment: .leading, spacing: 4) {
                    Text("Settimana \(e.week) · \(Format.shortDate(e.date))").bold()
                    Text("Peso: \(Format.kg(e.bodyKg)) kg")
                    Text("Panca: \(e.bench)")
                    Text("Squat: \(e.squat)")
                    Text("Rematore: \(e.row)")
                    if !e.notes.isEmpty { Text(e.notes).foregroundStyle(.secondary) }
                }
            }
            .onDelete { idx in for i in idx { context.delete(entries[i]) } }
        }
        .sheet(isPresented: $adding) { DiaryForm(prefill: prefill()) }
    }

    /// Miglior serie recente di un esercizio, es. "50 kg × 8".
    private func best(_ name: String) -> String {
        for s in sessions {
            if let e = s.exercises.first(where: { $0.name == name }),
               let top = e.doneSets.max(by: { ($0.kg, $0.reps) < ($1.kg, $1.reps) }) {
                return "\(Format.kg(top.kg)) kg × \(top.reps)"
            }
        }
        return ""
    }

    private func prefill() -> DiaryEntry {
        DiaryEntry(date: .now, week: WorkoutService.currentWeek(context).number,
                   bodyKg: weights.first?.kg ?? 56.1,
                   bench: best("Panca piana"), squat: best("Squat"), row: best("Rematore con bilanciere"), notes: "")
    }
}

private struct DiaryForm: View {
    let prefill: DiaryEntry
    @Environment(\.modelContext) private var context
    @Environment(\.dismiss) private var dismiss
    @State private var kg = ""
    @State private var bench = ""
    @State private var squat = ""
    @State private var row = ""
    @State private var notes = ""

    var body: some View {
        NavigationStack {
            Form {
                Section("Settimana \(prefill.week)") {
                    TextField("Peso corporeo kg", text: $kg).keyboardType(.decimalPad)
                    TextField("Panca (es. 50 kg × 8)", text: $bench)
                    TextField("Squat", text: $squat)
                    TextField("Rematore", text: $row)
                    TextField("Note", text: $notes, axis: .vertical)
                }
            }
            .navigationTitle("Diario")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Annulla") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Salva") {
                        context.insert(DiaryEntry(date: .now, week: prefill.week, bodyKg: Format.parse(kg) ?? prefill.bodyKg,
                                                  bench: bench, squat: squat, row: row, notes: notes))
                        try? context.save()
                        dismiss()
                    }
                }
            }
            .onAppear {
                kg = Format.kg(prefill.bodyKg); bench = prefill.bench; squat = prefill.squat; row = prefill.row
            }
        }
    }
}
