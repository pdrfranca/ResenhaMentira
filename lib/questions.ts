export const THEMES = [
  "Escola",
  "Trabalho",
  "Família",
  "Viagem",
  "Internet",
  "Primeiros encontros",
] as const;

export const QUESTIONS = [
  "Qual foi a situação mais vergonhosa que você já passou em uma chamada de vídeo?",
  "Qual foi a desculpa mais estranha que você já usou para faltar a algum compromisso?",
  "Qual seria seu superpoder mais inútil?",
  "Qual foi a coisa mais aleatória que você já pesquisou na internet às 3 da manhã?",
  "Qual foi o maior susto bobo que você já levou?",
  "Qual comida você defenderia mesmo sabendo que metade da humanidade odeia?",
  "Qual foi a compra mais desnecessária que você já fez?",
  "Qual foi a situação em que você mais tentou parecer inteligente?",
  "Qual foi a coisa mais estranha que já aconteceu com você em público?",
  "Qual seria o pior emprego possível para você?",
  "Qual hábito estranho você teria se ninguém pudesse te julgar?",
  "Qual foi a mentira mais inocente que já saiu pela sua boca?",
  "Qual foi a situação mais constrangedora em um grupo de mensagens?",
  "Que objeto você salvaria primeiro durante um apocalipse completamente sem sentido?",
  "Qual habilidade inútil você gostaria de dominar?",
  "Qual foi a coincidência mais absurda que já aconteceu com você?",
  "Qual seria o nome mais ridículo para um restaurante?",
  "Qual foi a maior confusão que você já causou sem querer?",
];

export function pickQuestion(round: number) {
  return QUESTIONS[(round - 1) % QUESTIONS.length];
}
