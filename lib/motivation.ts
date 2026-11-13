const dailyMessages = [
  "Um passo pequeno hoje ainda é um passo em direção ao seu sonho.",
  "Você não precisa estudar tudo de uma vez. Só precisa começar o próximo bloco.",
  "A constância de hoje constrói a confiança de amanhã.",
  "Cada questão resolvida deixa o caminho um pouco mais claro.",
  "Seu esforço silencioso também conta. Continue no seu ritmo.",
  "Não espere a motivação chegar: comece, e ela encontra você no caminho.",
  "Você já venceu o mais difícil: decidiu cuidar do seu futuro.",
  "Uma hora de foco pode mudar a forma como você se sente sobre a prova.",
  "Aprender é acumular pequenos encontros com o conteúdo. Hoje é mais um.",
  "Seu futuro não precisa de perfeição; precisa da sua presença hoje.",
  "Respire, escolha um assunto e faça o melhor próximo passo possível.",
  "A aprovação é um projeto de muitos dias. Este é o dia que está nas suas mãos.",
  "Você pode avançar com calma e ainda assim avançar muito.",
  "O estudo de hoje é um presente para a Sofia de amanhã.",
  "Confie no processo que você está construindo, uma sessão de cada vez.",
];

/** Returns one stable message per civil day in the student's timezone. */
export function dailyMotivation(date: string): string {
  const dayNumber = Math.floor(Date.parse(`${date}T12:00:00Z`) / 86_400_000);
  return dailyMessages[((dayNumber % dailyMessages.length) + dailyMessages.length) % dailyMessages.length];
}
