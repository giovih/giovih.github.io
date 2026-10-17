import SwiftUI
import SwiftData

/// Schermata "Oggi": allenamento del giorno e bottone grande per iniziare.
struct HomeView: View {
    @Binding var workout: WorkoutSession?
    @Environment(\.modelContext) private var context
    @Query(sort: \ScheduleDay.weekdayRaw) private var days: [ScheduleDay]
    @Query(sort: \WorkoutTemplate.order) private var templates: [WorkoutTemplate]
    @Query(filter: #Predicate<WorkoutSession> { $0.endDate == nil }) private var active: [WorkoutSession]
    @Query(sort: \WorkoutSession.date, order: .reverse) private var sessions: [WorkoutSession]
    @Query private var dayLogs: [DayLog]
    @Query private var settings: [AppSettings]

    private var today: Weekday { Weekday.from(.now, calendar: .italian) }
    private var todayTemplate: WorkoutTemplate? { days.first { $0.weekday == today }?.template }
    private var week: ProgramWeek { ProgramWeek.current(start: settings.first?.programStart ?? .now) }
    private var creatineTaken: Bool { dayLogs.first { $0.day == Format.dayKey(.now) }?.creatine ?? false }
    private var doneToday: Bool {
        sessions.contains { $0.endDate != nil && Calendar.current.isDateInToday($0.date) }
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 14) {
                    Text("Settimana \(week.number) · ciclo \(week.cycle)/8")
                        .foregroundStyle(.secondary)
                    weekStrip
                    alerts

                    if let s = active.first {
                        Button("▶︎ Riprendi \(s.templateName)") { workout = s }
                            .buttonStyle(BigButtonStyle(color: Color(hex: s.colorHex)))
                    } else if let t = todayTemplate {
                        TemplateCard(template: t)
                        if doneToday {
                            Label("Allenamento di oggi già fatto", systemImage: "checkmark.seal.fill")
                                .foregroundStyle(Theme.green)
                        }
                        Button("Inizia allenamento") { start(t) }
                            .buttonStyle(BigButtonStyle(color: Color(hex: t.colorHex)))
                    } else {
                        VStack(spacing: 8) {
                            Text("😴 Oggi riposo").font(.title2.bold())
                            Text("Mangia bene, dormi e prendi la creatina.").foregroundStyle(.secondary)
                        }
                        .frame(maxWidth: .infinity).padding(24)
                        .background(Theme.card, in: RoundedRectangle(cornerRadius: 16))
                    }

                    if active.isEmpty {
                        DisclosureGroup("Fai un altro allenamento") {
                            Text("Se hai saltato un allenamento, riprendi dal successivo senza raddoppiare.")
                                .font(.footnote).foregroundStyle(.secondary)
                            LazyVGrid(columns: [GridItem(), GridItem()]) {
                                ForEach(templates) { t in
                                    Button(t.name) { start(t) }
                                        .buttonStyle(BigButtonStyle(color: Color(hex: t.colorHex)))
                                }
                            }
                        }
                        .padding().background(Theme.card, in: RoundedRectangle(cornerRadius: 14))
                    }
                }
                .padding()
            }
            .navigationTitle(today.label)
        }
    }

    private var weekStrip: some View {
        HStack(spacing: 5) {
            ForEach(Weekday.allCases) { d in
                let t = days.first { $0.weekday == d }?.template
                VStack(spacing: 2) {
                    Text(d.short).font(.caption2.bold())
                    Text(t.map { $0.name.replacingOccurrences(of: "Upper ", with: "") } ?? "–").font(.caption)
                }
                .frame(maxWidth: .infinity).padding(.vertical, 8)
                .background(t.map { Color(hex: $0.colorHex) } ?? Theme.card, in: RoundedRectangle(cornerRadius: 10))
                .overlay(RoundedRectangle(cornerRadius: 10).stroke(.white, lineWidth: d == today ? 3 : 0))
                .opacity(d == today ? 1 : 0.75)
            }
        }
    }

    @ViewBuilder private var alerts: some View {
        if !creatineTaken {
            AlertRow(text: "💊 Ricordati la creatina (5 g, anche nei giorni di riposo)", color: Theme.accent)
        }
        if week.isDeload {
            AlertRow(text: "⚠️ Settimana 8: SCARICO. Metà serie e -10% di peso. Dalla prossima riparti dai pesi di prima.", color: Theme.yellow)
        } else if week.cycle == 7 {
            AlertRow(text: "La prossima settimana è di scarico.", color: Theme.accent)
        }
        if week.dropSetsActive {
            AlertRow(text: "🔥 Drop set attivi: ultima serie di alzate laterali, croci e curl inclinato.", color: Theme.accent)
        }
        if week.isDiaryWeek {
            AlertRow(text: "📓 Settimana \(week.number): compila il diario (Storico → Diario).", color: Theme.accent)
        }
    }

    private func start(_ t: WorkoutTemplate) {
        workout = WorkoutService.start(t, context: context)
        AppBlocker.shared.apply(workoutActive: true)
    }
}

struct AlertRow: View {
    let text: String
    let color: Color
    var body: some View {
        Text(text).font(.subheadline)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(12)
            .background(Theme.card, in: RoundedRectangle(cornerRadius: 10))
            .overlay(alignment: .leading) { Rectangle().fill(color).frame(width: 4).clipShape(RoundedRectangle(cornerRadius: 2)) }
    }
}

/// Riquadro di una seduta con l'elenco degli esercizi.
struct TemplateCard: View {
    let template: WorkoutTemplate

    var body: some View {
        VStack(spacing: 0) {
            HStack {
                Text(template.name).font(.title2.bold())
                Spacer()
                Text(template.subtitle).font(.subheadline)
            }
            .padding().background(Color(hex: template.colorHex))
            ForEach(Array(template.sortedItems.enumerated()), id: \.element.id) { i, item in
                HStack {
                    Text(item.exercise?.name ?? "?")
                    if item.supersetGroup != nil { SSBadge() }
                    Spacer()
                    Text(item.setsRepsLabel).bold().monospacedDigit()
                    Text(item.restLabel).font(.callout).foregroundStyle(.secondary)
                        .frame(width: 64, alignment: .trailing)
                }
                .padding(.horizontal).padding(.vertical, 9)
                .background(i % 2 == 0 ? Theme.row : Theme.card)
            }
        }
        .background(Theme.card)
        .clipShape(RoundedRectangle(cornerRadius: 16))
    }
}

struct SSBadge: View {
    var body: some View {
        Text("SS").font(.caption2.bold()).foregroundStyle(Theme.yellow)
            .padding(.horizontal, 5).padding(.vertical, 1)
            .background(Theme.yellow.opacity(0.2), in: Capsule())
    }
}
