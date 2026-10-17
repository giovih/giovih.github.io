import SwiftUI
import SwiftData
import Charts
import PhotosUI

/// Conta cibo: macro della giornata, acqua, creatina, pasti, peso corporeo.
struct CiboView: View {
    @Environment(\.modelContext) private var context
    @Query private var settingsList: [AppSettings]
    @Query(sort: \FoodEntry.createdAt) private var allFood: [FoodEntry]
    @Query private var dayLogs: [DayLog]
    @Query(sort: \BodyWeight.date) private var weights: [BodyWeight]

    @State private var day = Date.now
    @State private var addingTo: Meal?
    @State private var weightText = ""

    private var key: String { Format.dayKey(day) }
    private var food: [FoodEntry] { allFood.filter { $0.day == key } }
    private var settings: AppSettings? { settingsList.first }
    private var isToday: Bool { Calendar.current.isDateInToday(day) }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 14) {
                    dayNav
                    macros
                    waterAndCreatine
                    ForEach(Meal.allCases) { meal in mealCard(meal) }
                    weightCard
                }
                .padding()
            }
            .navigationTitle("Cibo")
            .sheet(item: $addingTo) { meal in AddFoodSheet(meal: meal, day: key) }
        }
    }

    // MARK: Parti della schermata

    private var dayNav: some View {
        HStack {
            Button { day = Calendar.current.date(byAdding: .day, value: -1, to: day)! } label: {
                Image(systemName: "chevron.left").frame(width: 44, height: 44)
            }
            Spacer()
            Text(isToday ? "Oggi" : Format.shortDate(day)).font(.headline)
            Spacer()
            Button { day = Calendar.current.date(byAdding: .day, value: 1, to: day)! } label: {
                Image(systemName: "chevron.right").frame(width: 44, height: 44)
            }
            .disabled(isToday)
        }
        .buttonStyle(.bordered)
    }

    private var macros: some View {
        let kcal = food.reduce(0) { $0 + $1.kcal }
        let p = food.reduce(0) { $0 + $1.protein }
        let c = food.reduce(0) { $0 + $1.carbs }
        let f = food.reduce(0) { $0 + $1.fat }
        let s = settings
        return VStack(spacing: 12) {
            ProgressRow(title: "Calorie", value: Double(kcal), target: Double(s?.kcalMax ?? 3300),
                        label: "\(kcal) / \(s?.kcalMin ?? 3000)-\(s?.kcalMax ?? 3300) kcal", color: Theme.accent)
            ProgressRow(title: "Proteine", value: Double(p), target: Double(s?.proteinMin ?? 120),
                        label: "\(p) / ≥\(s?.proteinMin ?? 120) g", color: .blue)
            ProgressRow(title: "Carboidrati", value: Double(c), target: Double(s?.carbsTarget ?? 400),
                        label: "\(c) / \(s?.carbsTarget ?? 400) g", color: Theme.yellow)
            ProgressRow(title: "Grassi", value: Double(f), target: Double(s?.fatTarget ?? 85),
                        label: "\(f) / \(s?.fatTarget ?? 85) g", color: .purple)
        }
        .padding().background(Theme.card, in: RoundedRectangle(cornerRadius: 16))
    }

    private var log: DayLog {
        if let l = dayLogs.first(where: { $0.day == key }) { return l }
        let l = DayLog(day: key)
        context.insert(l)
        return l
    }

    private var waterAndCreatine: some View {
        let ml = dayLogs.first(where: { $0.day == key })?.waterMl ?? 0
        let creatine = dayLogs.first(where: { $0.day == key })?.creatine ?? false
        return VStack(spacing: 12) {
            ProgressRow(title: "💧 Acqua", value: Double(ml), target: 3000,
                        label: "\(Format.kg(Double(ml) / 1000)) / 2-3 L", color: .cyan)
            HStack {
                Button("−") { log.waterMl = max(0, log.waterMl - 250) }
                Button("+ 250 ml") { log.waterMl += 250 }
                Button("+ 500 ml") { log.waterMl += 500 }
            }
            .buttonStyle(.bordered).controlSize(.large)
            Button {
                log.creatine.toggle()
                if log.creatine { Notifiche.cancelCreatineToday() }
            } label: {
                Text(creatine ? "✅ Creatina 5 g presa" : "💊 Creatina 5 g — tocca quando la prendi")
                    .frame(maxWidth: .infinity, minHeight: 48)
            }
            .buttonStyle(.borderedProminent)
            .tint(creatine ? Theme.green : Theme.row)
        }
        .padding().background(Theme.card, in: RoundedRectangle(cornerRadius: 16))
    }

    private func mealCard(_ meal: Meal) -> some View {
        let items = food.filter { $0.meal == meal }
        let kcal = items.reduce(0) { $0 + $1.kcal }
        return VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text("\(meal.icon) \(meal.label)").font(.headline)
                Spacer()
                if kcal > 0 { Text("\(kcal) kcal").foregroundStyle(.secondary) }
            }
            ForEach(items) { item in
                HStack(spacing: 10) {
                    if let d = item.photo, let img = UIImage(data: d) {
                        Image(uiImage: img).resizable().scaledToFill()
                            .frame(width: 48, height: 48).clipShape(RoundedRectangle(cornerRadius: 10))
                    } else {
                        Text("🍴").frame(width: 48, height: 48).background(Theme.row, in: RoundedRectangle(cornerRadius: 10))
                    }
                    VStack(alignment: .leading) {
                        Text(item.text.isEmpty ? "Pasto" : item.text).lineLimit(2)
                        Text("\(item.kcal) kcal · P \(item.protein) · C \(item.carbs) · G \(item.fat)")
                            .font(.caption).foregroundStyle(.secondary)
                    }
                    Spacer()
                }
                .contextMenu {
                    Button("Elimina", role: .destructive) { context.delete(item) }
                }
            }
            Button { addingTo = meal } label: {
                Label("Aggiungi", systemImage: "plus").frame(maxWidth: .infinity, minHeight: 40)
            }
            .buttonStyle(.bordered)
        }
        .padding().background(Theme.card, in: RoundedRectangle(cornerRadius: 16))
    }

    private var weightCard: some View {
        let advice = NutritionAdvisor.advice(weights: weights.map(\.kg))
        return VStack(alignment: .leading, spacing: 10) {
            HStack {
                Text("⚖️ Peso corporeo").font(.headline)
                Spacer()
                Text("1 volta a settimana, a digiuno").font(.caption).foregroundStyle(.secondary)
            }
            HStack {
                TextField("kg", text: $weightText).keyboardType(.decimalPad)
                    .padding(12).background(Theme.row, in: RoundedRectangle(cornerRadius: 10))
                Button("Salva") { saveWeight() }.buttonStyle(.borderedProminent)
            }
            if weights.count >= 2 {
                Chart(weights) {
                    LineMark(x: .value("Data", $0.date), y: .value("kg", $0.kg))
                    PointMark(x: .value("Data", $0.date), y: .value("kg", $0.kg))
                }
                .foregroundStyle(.green)
                .chartYScale(domain: .automatic(includesZero: false))
                .frame(height: 160)
            }
            Text(advice.text).font(.subheadline)
            if advice.kcalDelta != 0, let s = settings {
                Button("Applica: \(advice.kcalDelta > 0 ? "+" : "")\(advice.kcalDelta) kcal all'obiettivo") {
                    s.kcalMin += advice.kcalDelta
                    s.kcalMax += advice.kcalDelta
                    s.carbsTarget += advice.kcalDelta / 4
                }
                .buttonStyle(.bordered)
            }
        }
        .padding().background(Theme.card, in: RoundedRectangle(cornerRadius: 16))
    }

    private func saveWeight() {
        guard let kg = Format.parse(weightText), kg > 30, kg < 150 else { return }
        // un solo peso al giorno
        for w in weights where Calendar.current.isDateInToday(w.date) { context.delete(w) }
        context.insert(BodyWeight(date: .now, kg: kg))
        weightText = ""
        try? context.save()
    }
}

// MARK: - Aggiungi cibo

struct AddFoodSheet: View {
    let meal: Meal
    let day: String

    @Environment(\.modelContext) private var context
    @Environment(\.dismiss) private var dismiss
    @State private var pickerItem: PhotosPickerItem?
    @State private var showCamera = false
    @State private var image: UIImage?
    @State private var text = ""
    @State private var kcal = ""
    @State private var protein = ""
    @State private var carbs = ""
    @State private var fat = ""
    @State private var info = ""
    @State private var loading = false

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    HStack {
                        Button { showCamera = true } label: { Label("Scatta", systemImage: "camera.fill") }
                            .buttonStyle(.bordered)
                        PhotosPicker(selection: $pickerItem, matching: .images) {
                            Label("Libreria", systemImage: "photo.on.rectangle")
                        }
                        .buttonStyle(.bordered)
                    }
                    if let image {
                        Image(uiImage: image).resizable().scaledToFill()
                            .frame(height: 200).clipShape(RoundedRectangle(cornerRadius: 12))
                    }
                    TextField("Es. 110 g di pasta con 80 g di pollo, 1 cucchiaio d'olio", text: $text, axis: .vertical)
                        .lineLimit(2...5)
                }
                Section {
                    Button {
                        Task { await estimate() }
                    } label: {
                        HStack {
                            Text("✨ Stima con AI").bold()
                            if loading { Spacer(); ProgressView() }
                        }
                    }
                    .disabled(loading || (image == nil && text.isEmpty))
                    if !info.isEmpty { Text(info).font(.callout) }
                }
                Section("Valori (puoi correggerli)") {
                    numberField("kcal", $kcal)
                    numberField("Proteine g", $protein)
                    numberField("Carboidrati g", $carbs)
                    numberField("Grassi g", $fat)
                }
            }
            .navigationTitle(meal.label)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Annulla") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) { Button("Salva") { save() }.disabled(Int(kcal) == nil) }
            }
            .onChange(of: pickerItem) { _, item in
                Task {
                    if let d = try? await item?.loadTransferable(type: Data.self), let img = UIImage(data: d) { image = img }
                }
            }
            .fullScreenCover(isPresented: $showCamera) {
                CameraPicker { image = $0 }.ignoresSafeArea()
            }
        }
    }

    private func numberField(_ title: String, _ value: Binding<String>) -> some View {
        HStack {
            Text(title)
            TextField("0", text: value).keyboardType(.numberPad).multilineTextAlignment(.trailing).bold()
        }
    }

    private func estimate() async {
        loading = true
        defer { loading = false }
        do {
            let e = try await ClaudeClient.estimateFood(jpeg: image?.jpeg(maxSide: 1024), description: text)
            kcal = String(e.kcal); protein = String(e.proteine); carbs = String(e.carboidrati); fat = String(e.grassi)
            if text.isEmpty { text = e.descrizione }
            info = "\(e.descrizione): circa \(e.kcal) kcal (tra \(e.kcal_min) e \(e.kcal_max)).\n\(e.note)"
        } catch {
            info = "❌ " + error.localizedDescription
        }
    }

    private func save() {
        context.insert(FoodEntry(day: day, meal: meal, text: text,
                                 kcal: Int(kcal) ?? 0, protein: Int(protein) ?? 0,
                                 carbs: Int(carbs) ?? 0, fat: Int(fat) ?? 0,
                                 photo: image?.jpeg(maxSide: 240)))
        try? context.save()
        dismiss()
    }
}

/// Fotocamera di iOS.
struct CameraPicker: UIViewControllerRepresentable {
    var onImage: (UIImage) -> Void
    @Environment(\.dismiss) private var dismiss

    func makeUIViewController(context: Context) -> UIImagePickerController {
        let p = UIImagePickerController()
        p.sourceType = UIImagePickerController.isSourceTypeAvailable(.camera) ? .camera : .photoLibrary
        p.delegate = context.coordinator
        return p
    }

    func updateUIViewController(_ vc: UIImagePickerController, context: Context) {}

    func makeCoordinator() -> Coordinator { Coordinator(self) }

    final class Coordinator: NSObject, UIImagePickerControllerDelegate, UINavigationControllerDelegate {
        let parent: CameraPicker
        init(_ p: CameraPicker) { parent = p }

        func imagePickerController(_ picker: UIImagePickerController,
                                   didFinishPickingMediaWithInfo info: [UIImagePickerController.InfoKey: Any]) {
            if let img = info[.originalImage] as? UIImage { parent.onImage(img) }
            parent.dismiss()
        }

        func imagePickerControllerDidCancel(_ picker: UIImagePickerController) { parent.dismiss() }
    }
}

extension UIImage {
    /// JPEG ridimensionato (lato lungo al massimo `maxSide` pixel).
    func jpeg(maxSide: CGFloat, quality: CGFloat = 0.8) -> Data? {
        let scale = min(1, maxSide / max(size.width, size.height))
        let target = CGSize(width: size.width * scale, height: size.height * scale)
        let format = UIGraphicsImageRendererFormat()
        format.scale = 1
        let img = UIGraphicsImageRenderer(size: target, format: format).image { _ in draw(in: CGRect(origin: .zero, size: target)) }
        return img.jpegData(compressionQuality: quality)
    }
}
