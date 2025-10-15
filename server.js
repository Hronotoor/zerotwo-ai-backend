const express = require("express");
const cors = require("cors");
const axios = require("axios");
require("dotenv").config();

const app = express();
const port = 3000;

// Мидлвары
app.use(cors());
app.use(express.json());

// Идентификатор твоего агента Mistral Agent Builder
const AGENT_ID = "ag:fff2a3f7:20251012:untitled-agent:4a81e5a0";

// Основной маршрут
app.post("/ask", async (req, res) => {
  try {
    const {
      gender,
      age,
      allergies,
      diagnosis,
      prescriptions,
      other,
      conversation_id,
    } = req.body;

    // Проверяем заполненность полей
    if (!gender || !age || !allergies || !diagnosis || !prescriptions) {
      return res
        .status(400)
        .json({ error: "Все поля обязательны для заполнения." });
    }

    // Проверяем наличие API ключа
    if (!process.env.MISTRAL_API_KEY) {
      return res.status(500).json({
        error: "API ключ не настроен",
        hint: "Добавьте MISTRAL_API_KEY=ваш_ключ в .env",
      });
    }

    // Формируем сообщение пользователя
    const userMessage = `
Пациент:
- Пол: ${gender}
- Возраст: ${age}
- Аллергические реакции: ${allergies}
- Диагноз: ${diagnosis}
- Назначения: ${prescriptions}
${other ? `- Дополнительная информация: ${other}` : ""}
`;

    console.log("📨 Отправка запроса к Mistral Agents API...");

    // Формируем запрос к API Mistral Agents
    const response = await axios.post(
      "https://api.mistral.ai/v1/conversations",
      {
        inputs: userMessage,
        agent_id: AGENT_ID,
        stream: false,
        store: true,
        conversation_id: conversation_id || undefined,
      },
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.MISTRAL_API_KEY}`,
          Accept: "application/json",
        },
      }
    );

    // Обработка ответа
    const data = response.data;
    const outputs = Array.isArray(data.outputs) ? data.outputs : [];
    const aiText = outputs
      .map((o) => {
        if (typeof o.content === "string") return o.content;
        try {
          return JSON.stringify(o.content, null, 2);
        } catch {
          return String(o.content ?? "");
        }
      })
      .join("\n\n");

    console.log("✅ Ответ получен от агента Mistral");

    res.json({
      success: true,
      response: aiText,
      conversation_id: data.conversation_id ?? null,
    });
  } catch (error) {
    console.error(
      "❌ Ошибка при работе с Mistral Agents API:",
      error?.response?.data || error
    );

    let errorMessage = "Произошла ошибка при обработке запроса";
    if (error?.response?.status === 401) errorMessage = "Неверный API ключ";
    else if (error?.response?.status === 429)
      errorMessage = "Превышен лимит запросов";
    else if (error?.code === "ECONNREFUSED")
      errorMessage = "Не удалось подключиться к API";
    else if (error?.response?.status === 404)
      errorMessage = "API endpoint не найден";

    res.status(500).json({
      success: false,
      error: errorMessage,
      details: error?.response?.data || error?.message || String(error),
    });
  }
});

// Старт сервера
app.listen(port, () => {
  console.log(`🚀 Сервер запущен на http://localhost:${port}`);
  console.log(`POST запросы отправлять на http://localhost:${port}/ask`);
});
