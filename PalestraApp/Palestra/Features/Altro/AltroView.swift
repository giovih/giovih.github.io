import SwiftUI
import SwiftData
import UniformTypeIdentifiers

/// Impostazioni e strumenti.
struct AltroView: View {
    @Environment(\.modelContext) private var context
    @Query private var settingsList: [AppSettings]
    @State private var keyText = ""
    @State private var hasKey = Keychain.apiKey != nil
    @State private var importing = false
    @State private var message: String?

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    NavigationLink("📋 Scheda e calendario") { SchedaView() }
                    NavigationLink("🚫 Blocco app") { BlockView() }
                }

                if let s = settingsList.first {
                    SettingsSection(settings: s)
                }

                Section {
                    SecureField("sk-ant-…", text: $keyText)
                        .textInputAutocapitalization(.never).autocorrectionDisabled()
                    Button("Salva chiave") {
                        Keychain.apiKey = keyText.trimmingCharacters(in: .whitespacesAndNewlines)
                        hasKey = Keychain.apiKey != nil
                        keyText = ""
                    }
                    if hasKey {
                        Button("Cancella chiave", role: .destructive) { Keychain.apiKey = nil; hasKey = false }
                    }
                } header: {
                    Text("Chiave AI (cibo e coach)")
                } footer: {
                    Text(hasKey ? "✅ Chiave salvata nel Portachiavi di iOS, solo su questo iPhone."
                                : "Crea la chiave su console.anthropic.com. Non è scritta nel codice dell'app.")
                }

                Section {
                    Button("Importa backup dalla versione web") { importing = true }
                } footer: {
                    Text("Nella web app: Altro → Salva backup. Poi scegli qui il file .json.")
                }
            }
            .navigationTitle("Altro")
            .fileImporter(isPresented: $importing, allowedContentTypes: [.json]) { result in
                guard case .success(let url) = result else { return }
                let ok = url.startAccessingSecurityScopedResource()
                defer { if ok { url.stopAccessingSecurityScopedResource() } }
                do {
                    let n = try WebBackupImporter.importFile(url, context: context)
                    message = "Importati \(n.sessions) allenamenti, \(n.food) cibi, \(n.weights) pesi."
                } catch {
                    message = "File non valido: \(error.localizedDescription)"
                }
            }
            .alert("Backup", isPresented: Binding(get: { message != nil }, set: { if !$0 { message = nil } })) {
                Button("OK") {}
            } message: { Text(message ?? "") }
        }
    }
}

private struct SettingsSection: View {
    @Bindable var settings: AppSettings

    var body: some View {
        Section {
            DatePicker("Inizio settimana 1", selection: Binding(
                get: { settings.programStart },
                set: { settings.programStart = Calendar.italian.startOfWeek(for: $0) }),
                displayedComponents: .date)
            Stepper("Calorie min: \(settings.kcalMin)", value: $settings.kcalMin, in: 1500...5000, step: 50)
            Stepper("Calorie max: \(settings.kcalMax)", value: $settings.kcalMax, in: 1500...5000, step: 50)
            Stepper("Proteine: ≥\(settings.proteinMin) g", value: $settings.proteinMin, in: 50...250, step: 5)
            Stepper("Carboidrati: \(settings.carbsTarget) g", value: $settings.carbsTarget, in: 100...700, step: 10)
            Stepper("Grassi: \(settings.fatTarget) g", value: $settings.fatTarget, in: 30...200, step: 5)
        } header: {
            Text("Programma e obiettivi")
        } footer: {
            Text("Ora sei alla settimana \(ProgramWeek.current(start: settings.programStart).number).")
        }
    }
}

/// Importa il file di backup della web app (stesso formato di localStorage).
enum WebBackupImporter {
    struct Counts { var sessions = 0, food = 0, weights = 0 }

    static func importFile(_ url: URL, context: ModelContext) throws -> Counts {
        let data = try Data(contentsOf: url)
        guard let root = try JSONSerialization.jsonObject(with: data) as? [String: Any] else {
            throw CocoaError(.fileReadCorruptFile)
        }
        var n = Counts()
        let iso = ISO8601DateFormatter()
        iso.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        let exercises = (try? context.fetch(FetchDescriptor<Exercise>())) ?? []

        // allenamenti
        for s in root["sedute"] as? [[String: Any]] ?? [] {
            guard let ds = s["data"] as? String, let date = iso.date(from: ds) else { continue }
            let session = WorkoutSession(date: date, templateCode: s["codice"] as? String ?? "",
                                         templateName: s["nome"] as? String ?? "",
                                         colorHex: (s["colore"] as? String ?? "#888888").replacingOccurrences(of: "#", with: ""),
                                         week: s["settimana"] as? Int ?? 1, cycleWeek: s["ciclo"] as? Int ?? 1,
                                         isDeload: s["scarico"] as? Bool ?? false)
            session.endDate = (s["fine"] as? String).flatMap { iso.date(from: $0) } ?? date
            context.insert(session)
            for (i, v) in (s["voci"] as? [[String: Any]] ?? []).enumerated() {
                let name = v["ex"] as? String ?? "?"
                let eq = exercises.first { $0.name == name }?.equipment ?? .machine
                let se = SessionExercise(order: i, name: name, equipment: eq,
                                         repMin: v["min"] as? Int ?? 8, repMax: v["max"] as? Int ?? 10,
                                         restMinSec: v["recMin"] as? Int ?? 90, restMaxSec: v["recMax"] as? Int ?? 90,
                                         supersetGroup: v["ss"] as? Int, dropSet: v["drop"] as? Bool ?? false, hint: "")
                se.cleanTechnique = v["pulita"] as? Bool ?? true
                se.session = session
                context.insert(se)
                for (j, x) in (v["sets"] as? [[String: Any]] ?? []).enumerated() where x["fatto"] as? Bool == true {
                    let set = SetLog(index: j, kg: (x["kg"] as? NSNumber)?.doubleValue ?? 0,
                                     reps: (x["reps"] as? NSNumber)?.intValue ?? 0, done: true)
                    set.exercise = se
                    context.insert(set)
                }
            }
            n.sessions += 1
        }

        // cibo, acqua, creatina
        for (day, value) in root["cibo"] as? [String: Any] ?? [:] {
            guard let g = value as? [String: Any] else { continue }
            let log = DayLog(day: day)
            log.waterMl = g["acqua"] as? Int ?? 0
            log.creatine = g["creatina"] as? Bool ?? false
            context.insert(log)
            for (mealKey, list) in g["pasti"] as? [String: Any] ?? [:] {
                for f in list as? [[String: Any]] ?? [] {
                    let photo = (f["foto"] as? String)
                        .flatMap { $0.components(separatedBy: ",").last }
                        .flatMap { Data(base64Encoded: $0) }
                    context.insert(FoodEntry(day: day, meal: Meal(rawValue: mealKey) ?? .pranzo,
                                             text: f["desc"] as? String ?? "",
                                             kcal: f["kcal"] as? Int ?? 0, protein: f["prot"] as? Int ?? 0,
                                             carbs: f["carb"] as? Int ?? 0, fat: f["grassi"] as? Int ?? 0, photo: photo))
                    n.food += 1
                }
            }
        }

        // peso
        let dayFmt = DateFormatter()
        dayFmt.dateFormat = "yyyy-MM-dd"
        for p in root["peso"] as? [[String: Any]] ?? [] {
            guard let d = (p["data"] as? String).flatMap({ dayFmt.date(from: $0) }),
                  let kg = (p["kg"] as? NSNumber)?.doubleValue else { continue }
            context.insert(BodyWeight(date: d, kg: kg))
            n.weights += 1
        }
        try context.save()
        return n
    }
}
