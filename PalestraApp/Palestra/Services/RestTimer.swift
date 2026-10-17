import Foundation
import Observation
import UIKit

/// Timer di recupero. Salva l'ora di fine: resta giusto anche se chiudi l'app.
@Observable
final class RestTimer {
    static let shared = RestTimer()

    private(set) var endDate: Date?
    private(set) var total: Int = 0

    private init() {
        let t = UserDefaults.standard.double(forKey: "restEnd")
        if t > Date.now.timeIntervalSince1970 { endDate = Date(timeIntervalSince1970: t) }
    }

    var isRunning: Bool { endDate.map { $0 > .now } ?? false }

    func remaining(at now: Date = .now) -> Int {
        guard let endDate else { return 0 }
        return max(0, Int(endDate.timeIntervalSince(now).rounded(.up)))
    }

    func start(seconds: Int, next: String) {
        total = seconds
        set(Date.now.addingTimeInterval(TimeInterval(seconds)))
        Notifiche.scheduleRest(after: seconds, next: next)
        UIImpactFeedbackGenerator(style: .medium).impactOccurred()
    }

    func add(_ seconds: Int) {
        guard let endDate else { return }
        let new = endDate.addingTimeInterval(TimeInterval(seconds))
        total += seconds
        set(new)
        Notifiche.scheduleRest(after: Int(new.timeIntervalSinceNow), next: "")
    }

    func stop() {
        set(nil)
        Notifiche.cancelRest()
    }

    /// Chiamato dall'interfaccia quando il tempo arriva a zero.
    func finished() {
        guard endDate != nil else { return }
        set(nil)
        UINotificationFeedbackGenerator().notificationOccurred(.success)
    }

    private func set(_ d: Date?) {
        endDate = d
        UserDefaults.standard.set(d?.timeIntervalSince1970 ?? 0, forKey: "restEnd")
    }
}
