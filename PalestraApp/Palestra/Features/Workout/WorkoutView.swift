import SwiftUI
import SwiftData

/// Allenamento in corso: serie da compilare, timer di recupero, sostituzioni.
struct WorkoutView: View {
    @Bindable var session: WorkoutSession
    var onClose: () -> Void

    @Environment(\.modelContext) private var context
    @State private var timer = RestTimer.shared
    @State private var substituting: SessionExercise?
    @State private var finished = false
    @State private var confirmFinish = false
    @State private var confirmCancel = false
    @State private var past: [WorkoutSession] = []

    private var exercises: [SessionExercise] { session.sortedExercises }
    private var dropActive: Bool { session.cycleWeek >= 5 && session.cycleWeek < 8 }

    var body: some View {
        NavigationStack {
            if finished {
                SummaryView(session: session) { onClose() }
            } else {
                content
            }
        }
        .onAppear { past = WorkoutService.finishedSessions(context) }
    }

    private var content: some View {
        ScrollView {
            VStack(spacing: 14) {
                Text("Settimana \(session.week) · ciclo \(session.cycleWeek)/8\(session.isDeload ? " · SCARICO" : "")")
                    .font(.subheadline).foregroundStyle(.secondary)
                    .frame(maxWidth: .infinity, alignment: .leading)
                RulesBox()
                ForEach(Array(exercises.enumerated()), id: \.element.id) { i, ex in
                    let next = i + 1 < exercises.count ? exercises[i + 1] : nil
                    let pairedNext = (ex.supersetGroup != nil && next?.supersetGroup == ex.supersetGroup) ? next : nil
                    ExerciseCard(ex: ex, pairedNext: pairedNext, dropActive: dropActive && !session.isDeload,
                                 lastTime: lastTimeText(ex.name),
                                 onSubstitute: { substituting = ex },
                                 onCheck: { set in checked(set, in: ex, index: i) })
                }
                Button("Fine allenamento") { confirmFinish = true }
                    .buttonStyle(BigButtonStyle(color: Theme.green))
                Button("Annulla allenamento", role: .destructive) { confirmCancel = true }
                    .padding(.bottom, 30)
            }
            .padding()
        }
        .scrollDismissesKeyboard(.interactively)
        .safeAreaInset(edge: .top, spacing: 0) { WorkoutHeader(session: session) }
        .safeAreaInset(edge: .bottom, spacing: 0) {
            if timer.endDate != nil { RestBar(timer: timer) }
        }
        .toolbar {
            ToolbarItem(placement: .topBarLeading) {
                Button { onClose() } label: { Image(systemName: "chevron.down") }
                    .accessibilityLabel("Riduci")
            }
            ToolbarItemGroup(placement: .keyboard) {
                Spacer()
                Button("Fatto") { UIApplication.shared.sendAction(#selector(UIResponder.resignFirstResponder), to: nil, from: nil, for: nil) }
            }
        }
        .toolbarBackground(.hidden, for: .navigationBar)
        .sheet(item: $substituting) { ex in SubstituteSheet(sessionExercise: ex, templateCode: session.templateCode) }
        .confirmationDialog("Finire l'allenamento?", isPresented: $confirmFinish, titleVisibility: .visible) {
            Button("Fine e salva") { finish() }
        } message: {
            Text("Le serie non spuntate non vengono salvate.")
        }
        .confirmationDialog("Annullare l'allenamento?", isPresented: $confirmCancel, titleVisibility: .visible) {
            Button("Annulla e cancella", role: .destructive) { discard() }
        }
    }

    private func lastTimeText(_ name: String) -> String {
        guard let sets = WorkoutService.lastTime(of: name, in: past) else { return "mai fatto" }
        return sets.map { "\(Format.kg($0.kg))×\($0.reps)" }.joined(separator: " · ")
    }

    /// Spunta di una serie: parte il timer (in superserie solo dopo il secondo esercizio).
    private func checked(_ set: SetLog, in ex: SessionExercise, index: Int) {
        try? context.save()
        guard set.done else { return }
        let paired = ex.supersetGroup != nil && index + 1 < exercises.count
            && exercises[index + 1].supersetGroup == ex.supersetGroup
        if paired {
            timer.stop()
            UIImpactFeedbackGenerator(style: .light).impactOccurred()
            return
        }
        // prossimo esercizio da fare, per il testo della notifica
        let remainingHere = ex.sets.contains { !$0.done }
        let nextName = remainingHere ? ex.name : (index + 1 < exercises.count ? exercises[index + 1].name : "fine!")
        timer.start(seconds: ex.restMaxSec, next: nextName)
    }

    private func finish() {
        guard session.exercises.contains(where: { !$0.doneSets.isEmpty }) else { return discard() }
        WorkoutService.finish(session, context: context)
        AppBlocker.shared.apply(workoutActive: false)
        finished = true
    }

    /// Chiude la schermata e poi cancella la seduta (prima si chiude, così non mostra dati cancellati).
    private func discard() {
        RestTimer.shared.stop()
        AppBlocker.shared.apply(workoutActive: false)
        let s = session
        onClose()
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.6) {
            context.delete(s)
            try? context.save()
        }
    }
}

// MARK: - Barra in alto: durata e avanzamento

struct WorkoutHeader: View {
    let session: WorkoutSession

    var body: some View {
        let total = session.exercises.reduce(0) { $0 + $1.sets.count }
        let done = session.exercises.reduce(0) { $0 + $1.sets.filter(\.done).count }
        let pct = total > 0 ? Double(done) / Double(total) : 0
        VStack(spacing: 6) {
            HStack {
                Text(session.templateName).font(.title3.bold())
                Spacer()
                TimelineView(.periodic(from: .now, by: 1)) { ctx in
                    Label(Format.duration(Int(ctx.date.timeIntervalSince(session.date))), systemImage: "stopwatch")
                        .font(.title3.monospacedDigit())
                }
            }
            HStack {
                Text("\(done)/\(total) serie")
                Spacer()
                Text("\(Int(pct * 100))%")
            }
            .font(.subheadline).foregroundStyle(.secondary)
            ProgressView(value: pct)
                .tint(Color(hex: session.colorHex))
                .scaleEffect(x: 1, y: 2.5, anchor: .center)
                .animation(.easeOut, value: pct)
        }
        .padding(.horizontal).padding(.vertical, 10)
        .background(.bar)
    }
}

// MARK: - Barra del recupero

struct RestBar: View {
    let timer: RestTimer

    var body: some View {
        TimelineView(.periodic(from: .now, by: 0.5)) { ctx in
            let r = timer.remaining(at: ctx.date)
            HStack(spacing: 8) {
                Button("−15") { timer.add(-15) }
                Spacer()
                VStack(spacing: 0) {
                    Text("Recupero").font(.caption.bold())
                    Text(Format.duration(r)).font(.system(size: 34, weight: .heavy).monospacedDigit())
                }
                Spacer()
                Button("+15") { timer.add(15) }
                Button("Salta") { timer.stop() }
            }
            .buttonStyle(.bordered)
            .tint(.black)
            .foregroundStyle(.black)
            .padding(12)
            .background(Theme.accent, in: RoundedRectangle(cornerRadius: 18))
            .padding(.horizontal).padding(.bottom, 6)
            .onChange(of: r) { _, new in if new == 0 { timer.finished() } }
            .onAppear { if r == 0 { timer.finished() } }
        }
    }
}

// MARK: - Regole di esecuzione

struct RulesBox: View {
    static let rules = [
        "Riscaldamento: 5 min leggeri + 2 serie progressive del primo esercizio (metà peso × 8, poi 75% × 4). Non contano e non vanno nel diario.",
        "Squat, panca e stacco rumeno: lascia sempre almeno 1 ripetizione in canna. Isolamenti: l'ultima serie può arrivare a cedimento.",
        "Discesa in 2-3 s, ampiezza completa. 1 s di pausa in basso su panca e squat; 1-2 s in allungamento su croci, stacco rumeno e curl inclinato.",
        "Dolore acuto o articolare: fermati. Niente massimali a 1 ripetizione.",
    ]

    var body: some View {
        DisclosureGroup("📌 Regole di esecuzione") {
            VStack(alignment: .leading, spacing: 8) {
                ForEach(Self.rules, id: \.self) { Text("• " + $0).font(.subheadline) }
            }
            .padding(.top, 6)
        }
        .padding().background(Theme.card, in: RoundedRectangle(cornerRadius: 14))
    }
}

// MARK: - Riquadro di un esercizio

struct ExerciseCard: View {
    @Bindable var ex: SessionExercise
    let pairedNext: SessionExercise?
    let dropActive: Bool
    let lastTime: String
    var onSubstitute: () -> Void
    var onCheck: (SetLog) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(alignment: .firstTextBaseline) {
                Text(ex.name).font(.title3.bold())
                if ex.supersetGroup != nil { SSBadge() }
            }
            if let n = pairedNext {
                Text("SUPERSERIE → poi subito \(n.name), recupero a fine coppia")
                    .font(.caption.bold()).foregroundStyle(Theme.yellow)
            }
            HStack(spacing: 4) {
                Text(Format.setsReps(ex.sets.count, ex.repMin, ex.repMax)).bold()
                Text("· rec \(Format.rest(ex.restMinSec, ex.restMaxSec)) ·")
                Text("\(ex.equipment.label): \(ex.equipment.weightLabel)")
                    .foregroundStyle(ex.equipment == .dumbbell ? Theme.yellow : .primary)
                    .fontWeight(ex.equipment == .dumbbell ? .bold : .regular)
            }
            .font(.subheadline)
            Text("Ultima volta: \(lastTime)").font(.footnote).foregroundStyle(.secondary)
            Text("💡 " + ex.hint).font(.footnote).foregroundStyle(Color(hex: "FDBA74"))

            HStack {
                Text("#").frame(width: 26)
                Text(ex.equipment == .dumbbell ? "KG / MANUBRIO" : ex.equipment == .bodyweight ? "ZAVORRA KG" : "KG")
                    .frame(maxWidth: .infinity)
                Text("RIP").frame(maxWidth: .infinity)
                Spacer().frame(width: 64)
            }
            .font(.caption2.bold()).foregroundStyle(.secondary)

            ForEach(ex.sortedSets) { set in
                SetRow(set: set, number: set.index + 1) { onCheck(set) }
                if dropActive && ex.dropSet && set.index == ex.sets.count - 1 {
                    Text("🔥 DROP SET: cedimento → -25% (\(Format.kg(Progression.round(set.kg * 0.75))) kg) → di nuovo cedimento. Nel diario segna solo la serie normale.")
                        .font(.caption).foregroundStyle(Color(hex: "FCA5A5"))
                        .padding(8).background(.red.opacity(0.12), in: RoundedRectangle(cornerRadius: 8))
                }
            }

            Toggle("Tecnica pulita in tutte le serie", isOn: $ex.cleanTechnique)
                .font(.subheadline).tint(Theme.green)

            Button(action: onSubstitute) {
                Label("Macchina occupata? Cambia esercizio", systemImage: "arrow.left.arrow.right")
                    .frame(maxWidth: .infinity, minHeight: 44)
            }
            .buttonStyle(.bordered)
            .tint(Theme.accent)
        }
        .padding()
        .background(Theme.card, in: RoundedRectangle(cornerRadius: 16))
    }
}

/// Una serie: kg, ripetizioni, spunta.
struct SetRow: View {
    @Bindable var set: SetLog
    let number: Int
    var onCheck: () -> Void

    @State private var kgText = ""
    @State private var repsText = ""

    var body: some View {
        HStack(spacing: 8) {
            Text("\(number)").bold().foregroundStyle(.secondary).frame(width: 26)
            field("kg", text: $kgText, keyboard: .decimalPad)
                .onChange(of: kgText) { _, v in set.kg = Format.parse(v) ?? 0 }
            field("rip", text: $repsText, keyboard: .numberPad)
                .onChange(of: repsText) { _, v in set.reps = Int(v) ?? 0 }
            Button {
                set.done.toggle()
                onCheck()
            } label: {
                Image(systemName: "checkmark").font(.title2.bold())
                    .frame(width: 64, height: 52)
                    .background(set.done ? Theme.green : Color(hex: "374151"), in: RoundedRectangle(cornerRadius: 12))
                    .foregroundStyle(.white)
            }
            .buttonStyle(.plain)
            .sensoryFeedback(.success, trigger: set.done)
        }
        .onAppear {
            kgText = set.kg == 0 ? "" : Format.kg(set.kg)
            repsText = set.reps == 0 ? "" : String(set.reps)
        }
    }

    private func field(_ placeholder: String, text: Binding<String>, keyboard: UIKeyboardType) -> some View {
        TextField(placeholder, text: text)
            .keyboardType(keyboard)
            .multilineTextAlignment(.center)
            .font(.title2.bold().monospacedDigit())
            .frame(maxWidth: .infinity, minHeight: 52)
            .background(set.done ? Theme.green.opacity(0.18) : Color(hex: "0B1220"), in: RoundedRectangle(cornerRadius: 12))
            .overlay(RoundedRectangle(cornerRadius: 12).stroke(set.done ? Theme.green : Color(hex: "374151")))
    }
}
