const VIEW_URL =
  "https://docs.google.com/forms/d/e/1FAIpQLSejMylO76VoWtWNbiHgJSzJbu15dI3I4nLhm6wOWNdAiYjmbA/viewform";

const POST_URL =
  "https://docs.google.com/forms/u/0/d/e/1FAIpQLSejMylO76VoWtWNbiHgJSzJbu15dI3I4nLhm6wOWNdAiYjmbA/formResponse";


function decodeHtml(value = "") {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}


function hiddenValue(html, name) {
  const escaped =
    name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  const regex =
    new RegExp(
      `<input[^>]+name=["']${escaped}["'][^>]+value=["']([^"']*)["'][^>]*>`,
      "i"
    );

  const match = html.match(regex);

  return match
    ? decodeHtml(match[1])
    : "";
}


function getCookies(response) {
  if (
    response.headers &&
    typeof response.headers.getSetCookie === "function"
  ) {
    return response.headers
      .getSetCookie()
      .map(cookie => cookie.split(";")[0])
      .join("; ");
  }

  const single =
    response.headers.get("set-cookie");

  return single
    ? single.split(",").map(x => x.split(";")[0]).join("; ")
    : "";
}


export default async function handler(req, res) {

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({
      ok: false,
      error: "Método não permitido."
    });
  }


  try {

    const {
      nome = "",
      presenca = "",
      tamanho = "",
      mensagem = ""
    } = req.body || {};


    const nomeLimpo =
      String(nome).trim();

    const presencaLimpa =
      String(presenca).trim();

    const tamanhoLimpo =
      String(tamanho).trim();

    const mensagemLimpa =
      String(mensagem).trim();


    const presencasValidas =
    [
      "Sim, confirmo minha presença.",
      "Não poderei comparecer."
    ];


    const tamanhosValidos =
    [
      "",
      "33/34",
      "35/36",
      "37/38",
      "39/40",
      "41/42",
      "43/44"
    ];


    if (
      !nomeLimpo ||
      !presencasValidas.includes(presencaLimpa) ||
      !tamanhosValidos.includes(tamanhoLimpo)
    ) {
      return res.status(400).json({
        ok: false,
        error: "Dados do RSVP inválidos."
      });
    }


    /*
      Abre o formulário público a cada envio.
      Assim token, tag, fbzx e partialResponse não ficam
      congelados no código do convite.
    */
    const pagina =
    await fetch(
      VIEW_URL,
      {
        method: "GET",
        redirect: "follow",
        headers: {
          "User-Agent":
            "Mozilla/5.0 AppleWebKit/537.36 Chrome/154 Safari/537.36",
          "Accept":
            "text/html,application/xhtml+xml"
        }
      }
    );


    if (!pagina.ok) {
      throw new Error(
        `Não foi possível abrir o Google Forms (${pagina.status}).`
      );
    }


    const cookies =
    getCookies(pagina);


    const html =
    await pagina.text();


    const fvv =
    hiddenValue(html, "fvv") || "1";

    const partialResponse =
    hiddenValue(html, "partialResponse");

    const pageHistory =
    hiddenValue(html, "pageHistory") || "0";

    const fbzx =
    hiddenValue(html, "fbzx");

    const submissionTimestamp =
    hiddenValue(html, "submissionTimestamp") || "-1";

    const token =
    hiddenValue(html, "token");

    const tag =
    hiddenValue(html, "tag");


    if (
      !partialResponse ||
      !fbzx
    ) {
      throw new Error(
        "O Google Forms não forneceu os parâmetros necessários."
      );
    }


    const dados =
    new URLSearchParams();


    dados.set(
      "entry.62577334",
      nomeLimpo
    );


    dados.set(
      "entry.877086558",
      presencaLimpa
    );


    /*
      Os sentinelas existem no formulário público real.
    */
    dados.set(
      "entry.877086558_sentinel",
      ""
    );


    if (tamanhoLimpo) {
      dados.set(
        "entry.240675889",
        tamanhoLimpo
      );
    }


    dados.set(
      "entry.240675889_sentinel",
      ""
    );


    if (mensagemLimpa) {
      dados.set(
        "entry.2606285",
        mensagemLimpa
      );
    }


    dados.set(
      "fvv",
      fvv
    );


    dados.set(
      "partialResponse",
      partialResponse
    );


    dados.set(
      "pageHistory",
      pageHistory
    );


    dados.set(
      "fbzx",
      fbzx
    );


    dados.set(
      "submissionTimestamp",
      submissionTimestamp
    );


    if (token) {
      dados.set(
        "token",
        token
      );
    }


    if (tag) {
      dados.set(
        "tag",
        tag
      );
    }


    const respostaGoogle =
    await fetch(
      POST_URL,
      {
        method: "POST",
        redirect: "manual",
        headers: {
          "Content-Type":
            "application/x-www-form-urlencoded;charset=UTF-8",
          "Origin":
            "https://docs.google.com",
          "Referer":
            VIEW_URL,
          "User-Agent":
            "Mozilla/5.0 AppleWebKit/537.36 Chrome/154 Safari/537.36",
          ...(cookies
            ? { "Cookie": cookies }
            : {})
        },
        body: dados.toString()
      }
    );


    /*
      O Forms normalmente responde com 200 ou redirecionamento
      após aceitar a submissão.
    */
    const status =
    respostaGoogle.status;


    if (
      status !== 200 &&
      status !== 302 &&
      status !== 303
    ) {
      const corpo =
      await respostaGoogle.text();

      console.error(
        "Google Forms recusou:",
        status,
        corpo.slice(0, 500)
      );

      throw new Error(
        `Google Forms recusou o envio (${status}).`
      );
    }


    return res.status(200).json({
      ok: true
    });


  } catch (error) {

    console.error(
      "Erro RSVP:",
      error
    );


    return res.status(500).json({
      ok: false,
      error:
        error &&
        error.message
          ? error.message
          : "Falha ao enviar RSVP."
    });

  }

}
