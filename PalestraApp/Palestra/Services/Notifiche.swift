import Foundation
import UserNotifications

/// Notifiche locali: fine recupero, creatina, peso. Funzionano anche con l'account Apple gratuito.
enum Notifiche {
    private static let center = UNUserNotificationCenter.current()

    static func requestPermission() {
        center.requestAuthorization(options: [.alert, .sound, .badge]) { _, _ in }
    }

    /// Notifica di fine recupero: suona anche a schermo bloccato.
    static func scheduleRest(after seconds: Int, next: String) {
        cancelRest()
        let c = UNMutableNotificationContent()
        c.title = "Recupero finito 💪"
        c.body = "Via con la prossima serie: \(next)"
        c.sound = .default
        c.interruptionLevel = .active
        let t = UNTimeIntervalNotificationTrigger(timeInterval: TimeInterval(max(1, seconds)), repeats: false)
        center.add(UNNotificationRequest(identifier: "recupero", content: c, trigger: t))
    }

    static func cancelRest() {
        center.removePendingNotificationRequests(withIdentifiers: ["recupero"])
        center.removeDeliveredNotifications(withIdentifiers: ["recupero"])
    }

    /// Promemoria fissi: creatina ogni giorno, peso il lunedì mattina.
    static func scheduleDailyReminders(creatineHour: Int = 9) {
        let cr = UNMutableNotificationContent()
        cr.title = "💊 Creatina"
        cr.body = "5 g di creatina, anche nei giorni di riposo."
        cr.sound = .default
        var at = DateComponents(); at.hour = creatineHour; at.minute = 0
        center.add(UNNotificationRequest(identifier: "creatina", content: cr,
                                         trigger: UNCalendarNotificationTrigger(dateMatching: at, repeats: true)))

        let w = UNMutableNotificationContent()
        w.title = "⚖️ Peso settimanale"
        w.body = "Pesati a digiuno, dopo il bagno, e segnalo nell'app."
        w.sound = .default
        var mon = DateComponents(); mon.weekday = 2; mon.hour = 7; mon.minute = 15
        center.add(UNNotificationRequest(identifier: "peso", content: w,
                                         trigger: UNCalendarNotificationTrigger(dateMatching: mon, repeats: true)))
    }

    static func cancelCreatineToday() {
        center.removeDeliveredNotifications(withIdentifiers: ["creatina"])
    }
}

/// Mostra le notifiche anche quando l'app è aperta.
final class NotificationDelegate: NSObject, UNUserNotificationCenterDelegate {
    static let shared = NotificationDelegate()

    nonisolated func userNotificationCenter(_ center: UNUserNotificationCenter, willPresent notification: UNNotification,
                                withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void) {
        completionHandler([.banner, .sound])
    }
}
