import SwiftUI
import FamilyControls

/// Blocco di TikTok, Instagram ecc. con le API Screen Time.
struct BlockView: View {
    @State private var blocker = AppBlocker.shared
    @State private var picking = false
    @State private var newName = "Studio"
    @State private var newStart = Calendar.current.date(from: DateComponents(hour: 15)) ?? .now
    @State private var newEnd = Calendar.current.date(from: DateComponents(hour: 18)) ?? .now

    var body: some View {
        Form {
            if !blocker.isAuthorized {
                Section {
                    Button("Autorizza Tempo di utilizzo") { Task { await blocker.requestAuthorization() } }
                    if let e = blocker.authError { Text(e).font(.footnote).foregroundStyle(.red) }
                } footer: {
                    Text("Serve la capability Family Controls, disponibile con l'account sviluppatore Apple (99 €/anno). Con l'account gratuito usa i trucchi qui sotto.")
                }
            }

            Section("App da bloccare") {
                Button("Scegli app (\(blocker.selection.applicationTokens.count) app, \(blocker.selection.categoryTokens.count) categorie)") {
                    picking = true
                }
                .disabled(!blocker.isAuthorized)
            }

            Section("Quando") {
                Toggle("Blocco attivo adesso", isOn: Binding(
                    get: { blocker.manualOn },
                    set: { blocker.manualOn = $0; blocker.save(); blocker.apply(workoutActive: false) }))
                Toggle("Blocca durante l'allenamento", isOn: Binding(
                    get: { blocker.autoDuringWorkout },
                    set: { blocker.autoDuringWorkout = $0; blocker.save() }))
            }
            .disabled(!blocker.isAuthorized)

            Section {
                ForEach($blocker.schedules) { $s in
                    Toggle("\(s.name)  \(String(format: "%02d:%02d-%02d:%02d", s.startHour, s.startMinute, s.endHour, s.endMinute))",
                           isOn: $s.enabled)
                }
                .onDelete { blocker.schedules.remove(atOffsets: $0) }
                TextField("Nome (es. Studio, Notte)", text: $newName)
                DatePicker("Dalle", selection: $newStart, displayedComponents: .hourAndMinute)
                DatePicker("Alle", selection: $newEnd, displayedComponents: .hourAndMinute)
                Button("Aggiungi fascia") {
                    let a = Calendar.current.dateComponents([.hour, .minute], from: newStart)
                    let b = Calendar.current.dateComponents([.hour, .minute], from: newEnd)
                    blocker.schedules.append(BlockSchedule(name: newName, startHour: a.hour ?? 0, startMinute: a.minute ?? 0,
                                                           endHour: b.hour ?? 0, endMinute: b.minute ?? 0))
                }
                Button("Salva fasce orarie") { blocker.applySchedules() }
            } header: {
                Text("Fasce orarie")
            } footer: {
                Text("Le fasce orarie funzionano con l'estensione \"EstensioneBlocco\" (vedi LEGGIMI).")
            }
            .disabled(!blocker.isAuthorized)

            Section("Senza account a pagamento") {
                Text("**Durante l'allenamento**: app Comandi → Automazione → + → App → TikTok, Instagram… → È aperta → Esegui subito → Apri app → Palestra.")
                Text("**Studio e notte**: Impostazioni → Tempo di utilizzo → Tempo di inattività → Programmato.")
            }
            .font(.footnote)
        }
        .navigationTitle("Blocco app")
        .familyActivityPicker(isPresented: $picking, selection: Binding(
            get: { blocker.selection },
            set: { blocker.selection = $0; blocker.save() }))
    }
}
