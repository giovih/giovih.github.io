import SwiftUI
import SwiftData

/// Step 1: mostra il calendario (modificabile) e la scheda precaricata.
struct SchedaView: View {
    @Query(sort: \ScheduleDay.weekdayRaw) private var days: [ScheduleDay]
    @Query(sort: \WorkoutTemplate.order) private var templates: [WorkoutTemplate]

    var body: some View {
        NavigationStack {
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
                            ItemRow(item: item)
                        }
                    } header: {
                        Text("\(t.name) · \(t.subtitle)")
                            .font(.headline)
                            .foregroundStyle(Color(hex: t.colorHex))
                    }
                }

                Section {
                    Text("SS = superserie: i due esercizi di fila senza pausa, poi recuperi.")
                        .font(.footnote).foregroundStyle(.secondary)
                }
            }
            .navigationTitle("Scheda palestra")
        }
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
                        Text("SS").font(.caption2.bold())
                            .padding(.horizontal, 5).padding(.vertical, 1)
                            .background(.yellow.opacity(0.25), in: Capsule())
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
