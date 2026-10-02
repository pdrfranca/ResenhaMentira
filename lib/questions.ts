import type { Theme } from "@/types/game";

const normalQuestions = [
  "Qual foi a situação mais vergonhosa que você já passou em uma chamada de vídeo?",
  "Qual foi a desculpa mais estranha que você já usou para faltar a algum compromisso?",
  "Qual seria seu superpoder mais inútil?",
  "Qual foi a coisa mais aleatória que você já pesquisou na internet de madrugada?",
  "Qual foi a situação em que você mais tentou parecer inteligente e deu tudo errado?",
  "Qual objeto completamente inútil você defenderia ter em uma ilha deserta?",
  "Qual foi a comida mais estranha que você já provou?",
  "Qual foi a mentira mais boba que alguém já acreditou quando você contou?",
  "Qual mania sua faria um documentário parecer necessário?",
  "Qual foi o pior presente que você já recebeu e fingiu gostar?",
  "Qual foi a maior vergonha que você já passou por causa de um corretor automático?",
  "Qual profissão você teria certeza que seria péssimo exercendo?"
];

const themeQuestions: Partial<Record<Theme, string[]>> = {
  Escola: [
    "Qual foi a coisa mais absurda que você já fez para escapar de uma atividade?",
    "Qual foi a desculpa escolar mais criativa que você já ouviu?"
  ],
  Trabalho: [
    "Qual situação no trabalho você transformaria em episódio de comédia?",
    "Qual foi a desculpa mais improvável para atrasar uma tarefa?"
  ],
  Família: [
    "Qual foi a história familiar que parece mentira, mas ninguém consegue esquecer?",
    "Qual hábito de família você defenderia mesmo sabendo que é estranho?"
  ],
  Viagem: [
    "Qual foi o perrengue de viagem mais improvável que você já viveu?",
    "Qual coisa estranha você levaria numa viagem sem nenhuma utilidade?"
  ],
  Internet: [
    "Qual foi a situação mais vergonhosa que você já viveu por causa da internet?",
    "Qual foi a coisa mais estranha que você já encontrou online?"
  ],
  "Primeiros encontros": [
    "Qual foi o momento mais estranho que poderia acontecer em um primeiro encontro?",
    "Qual desculpa absurda alguém poderia usar para cancelar um primeiro encontro?"
  ]
};

export const themes: Theme[] = ["Escola", "Trabalho", "Família", "Viagem", "Internet", "Primeiros encontros"];

export function getQuestion(round: number, theme?: Theme) {
  const source = theme ? themeQuestions[theme] ?? normalQuestions : normalQuestions;
  return source[(round - 1) % source.length];
}
