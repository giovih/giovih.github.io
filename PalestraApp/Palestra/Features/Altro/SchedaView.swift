import SwiftUI
import SwiftData

/// Calendario (modificabile) e scheda: tocca un esercizio per cambiarlo.
struct SchedaView: View {
    @Query(sort: \ScheduleDay.weekdayRaw) private var days: [ScheduleDay]
    @Query(sort: \WorkoutTemplate.order) private var templates: [WorkoutTemplate]
    @State private var editing: TemplateItem?

    var body: some View {
            List {
                Section("Calendario (tocca per cambiare)") {
                    ForEach(days) { day in
                        DayRow(day: day, templates: templates)
                    }
                    Button("Alternativa: lun Gambe, mer A, ven B, dom C") { applyAlternative() }
                    Button("Ripristina: lun A, mer B, ven Gambe, sab C") { applyDefault() }
                }

                ForEach(templates) { t in
                    Section {
                        ForEach(t.sortedItems) { item in
                            Button { editing = item } label: { ItemRow(item: item) }
                                .foregroundStyle(.primary)
                        }
                    } header: {
                        Text("\(t.name) · \(t.subtitle)")
                            .font(.headline)
                            .foregroundStyle(Color(hex: t.colorHex))
                    }
                }

                Section {
                    Text("Tocca un esercizio per cambiarlo nella scheda.")
                        .font(.footnote).foregroundStyle(.secondary)
                    Text("SS = superserie: i due esercizi di fila senza pausa, poi recuperi.")
                        .font(.footnote).foregroundStyle(.secondary)
                }
            }
            .navigationTitle("Scheda e calendario")
            .sheet(item: $editing) { ChangeTemplateExercise(item: $0) }
    }

    private func set(_ plan: [Weekday: String]) {
        for d in days {
            d.template = plan[d.weekday].flatMap { code in templates.first { $0.code == code } }
        }
    }
    private func applyDefault() { set([.monday: "A", .wednesday: "B", .friday: "G", .saturday: "C"]) }
    private func applyAlternative() { set([.monday: "G", .wednesday: "A", .friday: "B", .sunday: "C"]) }
}

private struct DayRow: View {
    @Bindable var day: ScheduleDay
    let templates: [WorkoutTemplate]

    var body: some View {
        Picker(day.weekday.label, selection: $day.template) {
            Text("Riposo").tag(WorkoutTemplate?.none)
            ForEach(templates) { t in
                Text(t.name).tag(Optional(t))
            }
        }
        .font(.body.weight(.medium))
    }
}

private struct ItemRow: View {
    let item: TemplateItem

    var body: some View {
        HStack(alignment: .firstTextBaseline) {
            VStack(alignment: .leading, spacing: 2) {
                HStack(spacing: 6) {
                    Text(item.exercise?.name ?? "?")
                    if item.supersetGroup != nil {
                        SSBadge()
                    }
                }
                if let eq = item.exercise?.equipment {
                    Text(eq == .dumbbell ? "Manubri · peso per manubrio" : eq.label)
                        .font(.caption).foregroundStyle(.secondary)
                }
            }
            Spacer()
            Text(item.setsRepsLabel).bold().monospacedDigit()
            Text(item.restLabel)
                .font(.callout).foregroundStyle(.secondary)
                .frame(width: 70, alignment: .trailing)
        }
    }
}

/// Cambia per sempre l'esercizio di una riga della scheda.
private struct ChangeTemplateExercise: View {
    let item: TemplateItem
    @Environment(\.dismiss) private var dismiss
    @Query(sort: \Exercise.name) private var all: [Exercise]
    @State private var showAll = false

    var body: some View {
        NavigationStack {
            List {
                Toggle("Mostra tutti i gruppi muscolari", isOn: $showAll)
                ForEach(all.filter { $0 != item.exercise && (showAll || $0.muscle == item.exercise?.muscle) }) { ex in
                    Button {
                        item.exercise = ex
                        dismiss()
                    } label: {
                        HStack {
                            Text(ex.name).foregroundStyle(.primary)
                            Spacer()
                            Text(ex.equipment.label).foregroundStyle(.secondary)
                        }
                    }
                }
            }
            .navigationTitle(item.exercise?.name ?? "Esercizio")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .cancellationAction) { Button("Chiudi") { dismiss() } } }
        }
    }
}
