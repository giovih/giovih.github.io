import SwiftUI
import SwiftData

/// Sostituisci un esercizio con uno dello stesso gruppo muscolare, o creane uno tuo.
struct SubstituteSheet: View {
    let sessionExercise: SessionExercise
    let templateCode: String

    @Environment(\.modelContext) private var context
    @Environment(\.dismiss) private var dismiss
    @Query(sort: \Exercise.name) private var all: [Exercise]
    @Query private var templates: [WorkoutTemplate]

    @State private var alsoInTemplate = false
    @State private var showAllGroups = false
    @State private var newName = ""
    @State private var newMuscle: MuscleGroup = .chest
    @State private var newEquipment: Equipment = .machine

    private var current: Exercise? { all.first { $0.name == sessionExercise.name } }
    private var muscle: MuscleGroup { current?.muscle ?? .chest }
    private var options: [Exercise] {
        all.filter { $0.name != sessionExercise.name && (showAllGroups || $0.muscle == muscle) }
    }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    Toggle("Cambia anche nella scheda (per sempre)", isOn: $alsoInTemplate)
                    Toggle("Mostra tutti i gruppi muscolari", isOn: $showAllGroups)
                } footer: {
                    Text("\(muscle.label) · stesse serie, ripetizioni e recupero")
                }
                Section("Alternative") {
                    ForEach(options) { ex in
                        Button { choose(ex) } label: {
                            HStack {
                                Text(ex.name).foregroundStyle(.primary)
                                Spacer()
                                Text(ex.equipment.label).foregroundStyle(.secondary)
                            }
                        }
                    }
                }
                Section("Crea esercizio") {
                    TextField("Nome esercizio", text: $newName)
                    Picker("Gruppo", selection: $newMuscle) {
                        ForEach(MuscleGroup.allCases) { Text($0.label).tag($0) }
                    }
                    Picker("Attrezzo", selection: $newEquipment) {
                        ForEach(Equipment.allCases) { Text($0.label).tag($0) }
                    }
                    Button("Crea e usa") { create() }
                        .disabled(newName.trimmingCharacters(in: .whitespaces).isEmpty)
                }
            }
            .navigationTitle("Sostituisci \(sessionExercise.name)")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .cancellationAction) { Button("Chiudi") { dismiss() } } }
            .onAppear { newMuscle = muscle }
        }
    }

    private func create() {
        let name = newName.trimmingCharacters(in: .whitespaces)
        if let existing = all.first(where: { $0.name.caseInsensitiveCompare(name) == .orderedSame }) {
            return choose(existing)
        }
        let ex = Exercise(name: name, muscle: newMuscle, equipment: newEquipment, isCustom: true)
        context.insert(ex)
        choose(ex)
    }

    private func choose(_ ex: Exercise) {
        if alsoInTemplate,
           let t = templates.first(where: { $0.code == templateCode }),
           let item = t.items.first(where: { $0.exercise?.name == sessionExercise.name }) {
            item.exercise = ex
        }
        WorkoutService.substitute(sessionExercise, with: ex, context: context)
        dismiss()
    }
}

/// Fine allenamento: cosa fare la prossima volta.
struct SummaryView: View {
    let session: WorkoutSession
    var onDone: () -> Void

    @Environment(\.modelContext) private var context
    @State private var rows: [(name: String, text: String, hint: String)] = []

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 12) {
                if let end = session.endDate {
                    Text("\(session.templateName) · \(Format.duration(Int(end.timeIntervalSince(session.date))))")
                        .foregroundStyle(.secondary)
                }
                Text("Prossima volta").font(.title2.bold())
                ForEach(rows, id: \.name) { r in
                    VStack(alignment: .leading, spacing: 2) {
                        Text(r.name).bold()
                        Text(r.text).monospacedDigit()
                        Text(r.hint).font(.footnote).foregroundStyle(.secondary)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding().background(Theme.card, in: RoundedRectangle(cornerRadius: 12))
                }
                Button("OK", action: onDone).buttonStyle(BigButtonStyle())
            }
            .padding()
        }
        .navigationTitle("Fatto! 🎉")
        .onAppear(perform: load)
    }

    private func load() {
        let past = WorkoutService.finishedSessions(context)
        rows = session.sortedExercises.map { ex in
            let s = Progression.suggest(sets: max(ex.sets.count, 1), repMin: ex.repMin, repMax: ex.repMax,
                                        equipment: ex.equipment,
                                        history: WorkoutService.history(of: ex.name, in: past), deload: false)
            let reps = s.reps.map(String.init).joined(separator: " / ")
            return (ex.name, s.kg.map { "\(Format.kg($0)) kg × \(reps)" } ?? reps, s.message)
        }
    }
}
