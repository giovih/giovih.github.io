import Foundation

/// Stima del cibo restituita dall'AI.
struct FoodEstimate: Codable {
    let descrizione: String
    let kcal: Int
    let kcal_min: Int
    let kcal_max: Int
    let proteine: Int
    let carboidrati: Int
    let grassi: Int
    let note: String
}

enum ClaudeError: LocalizedError {
    case noKey, refused, badResponse(String)

    var errorDescription: String? {
        switch self {
        case .noKey: "Prima salva la chiave API in Altro → Chiave AI."
        case .refused: "La richiesta è stata rifiutata. Inserisci i valori a mano."
        case .badResponse(let m): m
        }
    }
}

/// Chiamate all'API di Anthropic (unica parte dell'app che usa internet).
enum ClaudeClient {
    private static let model = "claude-opus-5-5"

    /// Manda una richiesta e restituisce il testo della risposta.
    private static func send(_ body: [String: Any]) async throws -> String {
        guard let key = Keychain.apiKey else { throw ClaudeError.noKey }
        var body = body
        body["model"] = model
        body["fallbacks"] = "default"   // se il modello rifiuta, l'API riprova con un altro

        var req = URLRequest(url: URL(string: "https://api.anthropic.com/v1/messages")!)
        req.httpMethod = "POST"
        req.timeoutInterval = 120
        req.setValue("application/json", forHTTPHeaderField: "content-type")
        req.setValue(key, forHTTPHeaderField: "x-api-key")
        req.setValue("2023-06-01", forHTTPHeaderField: "anthropic-version")
        req.setValue("server-side-fallback-2026-07-01", forHTTPHeaderField: "anthropic-beta")
        req.httpBody = try JSONSerialization.data(withJSONObject: body)

        let (data, resp) = try await URLSession.shared.data(for: req)
        let json = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any] ?? [:]
        if let http = resp as? HTTPURLResponse, http.statusCode != 200 {
            let msg = (json["error"] as? [String: Any])?["message"] as? String ?? "Errore \(http.statusCode)"
            throw ClaudeError.badResponse(msg)
        }
        if json["stop_reason"] as? String == "refusal" { throw ClaudeError.refused }
        let blocks = json["content"] as? [[String: Any]] ?? []
        guard let text = blocks.first(where: { $0["type"] as? String == "text" })?["text"] as? String else {
            throw ClaudeError.badResponse("Risposta vuota.")
        }
        return text
    }

    // MARK: Cibo

    private static let foodSchema: [String: Any] = [
        "type": "object",
        "additionalProperties": false,
        "required": ["descrizione", "kcal", "kcal_min", "kcal_max", "proteine", "carboidrati", "grassi", "note"],
        "properties": [
            "descrizione": ["type": "string"],
            "kcal": ["type": "integer"], "kcal_min": ["type": "integer"], "kcal_max": ["type": "integer"],
            "proteine": ["type": "integer"], "carboidrati": ["type": "integer"], "grassi": ["type": "integer"],
            "note": ["type": "string"],
        ],
    ]

    /// Foto (JPEG) e/o descrizione → stima di calorie e macro.
    static func estimateFood(jpeg: Data?, description: String) async throws -> FoodEstimate {
        var content: [[String: Any]] = []
        if let jpeg {
            content.append(["type": "image",
                            "source": ["type": "base64", "media_type": "image/jpeg",
                                       "data": jpeg.base64EncodedString()]])
        }
        content.append(["type": "text", "text": """
            Stima i valori nutrizionali di questo pasto. Descrizione: "\(description.isEmpty ? "nessuna" : description)".
            Se la descrizione indica grammi o quantità, usali: valgono più della foto. Rispondi in italiano.
            kcal_min e kcal_max sono l'intervallo di incertezza. "descrizione" è un nome breve del piatto;
            "note" spiega in una frase le ipotesi fatte (porzioni, condimenti).
            """])
        let text = try await send([
            "max_tokens": 4000,
            "system": "Sei un nutrizionista che stima calorie e macronutrienti dei pasti con valori realistici per l'Italia.",
            "output_config": ["effort": "low", "format": ["type": "json_schema", "schema": foodSchema]],
            "messages": [["role": "user", "content": content]],
        ])
        return try JSONDecoder().decode(FoodEstimate.self, from: Data(text.utf8))
    }

    // MARK: Coach

    struct ChatTurn: Identifiable, Equatable {
        let id = UUID()
        let fromUser: Bool
        let text: String
    }

    /// Chat con il coach: riceve un riassunto dei tuoi dati e risponde.
    static func chat(history: [ChatTurn], dataSummary: String) async throws -> String {
        let system = """
            Sei "Coach", l'assistente dentro l'app palestra di un ragazzo di 15 anni (172 cm) che si allena per \
            l'ipertrofia con priorità alla parte alta e vuole salire di peso di 0,25-0,5 kg a settimana.
            Rispondi in italiano, breve e concreto, come un amico esperto. Usa i dati qui sotto.
            Regole: niente integratori a parte la creatina (5 g al giorno); niente diete estreme; niente massimali.
            Se parla di dolore acuto o articolare, digli di fermarsi e di parlarne con un genitore o un medico.

            DATI DELL'APP:
            \(dataSummary)
            """
        let messages = history.map { ["role": $0.fromUser ? "user" : "assistant", "content": $0.text] }
        return try await send([
            "max_tokens": 4000,
            "system": system,
            "output_config": ["effort": "low"],
            "messages": messages,
        ])
    }
}
