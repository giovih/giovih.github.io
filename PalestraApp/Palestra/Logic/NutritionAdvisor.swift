import Foundation

/// Consigli sulle calorie in base al peso settimanale.
enum NutritionAdvisor {
    enum Advice: Equatable {
        case needMoreData, addCalories, removeCalories, onTrack

        var text: String {
            switch self {
            case .needMoreData: "Pesati una volta a settimana, al mattino a digiuno. Obiettivo: +0,25-0,5 kg a settimana."
            case .addCalories: "Da 2 settimane non sali di peso: aggiungi +250 kcal al giorno."
            case .removeCalories: "Sali più di 0,7 kg a settimana da più settimane: togli 200 kcal al giorno."
            case .onTrack: "Stai salendo bene, continua così."
            }
        }
        /// Di quanto cambiare l'obiettivo calorico.
        var kcalDelta: Int {
            switch self {
            case .addCalories: 250
            case .removeCalories: -200
            default: 0
            }
        }
    }

    /// - Parameter weights: pesi settimanali in ordine di data.
    static func advice(weights: [Double]) -> Advice {
        guard weights.count >= 3 else { return .needMoreData }
        let w = Array(weights.suffix(3))
        if w[2] - w[0] <= 0 { return .addCalories }
        if w[1] - w[0] > 0.7 && w[2] - w[1] > 0.7 { return .removeCalories }
        return .onTrack
    }
}
