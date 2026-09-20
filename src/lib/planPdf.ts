import type { Cohort } from '../types';
import type { ChatMessage } from '../components/PlanningChat';

export async function downloadPlan(group: Cohort, messages: ChatMessage[], manual?: string) {
  const { jsPDF } = await import('jspdf');
  const pdf = new jsPDF();
  let y = 19;
  const write = (text: string, size = 10) => {
    pdf.setFontSize(size);
    const lines: string[] = pdf.splitTextToSize(text.replace(/[^\x20-\x7E\n]/g, '-'), 174);
    pdf.text(lines, 18, y); y += lines.length * size * .4 + 4;
  };
  write('CarePath | Planning summary', 18);
  write(group.name, 14);
  write(`Historical 2022 group data | ${new Date().toLocaleDateString('en-AU')}`);
  write(`${group.patients.toLocaleString('en-AU')} people | ${group.inpatientBedDays.toLocaleString('en-AU')} hospital days | ${group.edPresentations.toLocaleString('en-AU')} ED visits`);
  write('Ranked planning options', 12);
  group.recommended_interventions.forEach((item, i) => { write(`${i + 1}. ${item.name}: ${item.score.toFixed(1)}/100`); write(item.reason, 9); });
  if (manual) { write('Manual planning assumptions and result', 12); write(manual); }
  else {
    write('Conversation highlights (latest assistant replies)', 12);
    const replies = messages.slice(1).filter(m => m.role === 'assistant').slice(-3);
    const space = Math.max(3, Math.floor((263 - y) / 4));
    const text = replies.length ? replies.map(m => m.content).join('\n\n') : 'No replies yet. The opening summary uses the group figures and options above.';
    pdf.setFontSize(9);
    const lines: string[] = pdf.splitTextToSize(text.replace(/[^\x20-\x7E\n]/g, '-'), 174);
    const excerpt = lines.slice(0, space);
    if (lines.length > space) excerpt[excerpt.length - 1] = '... Highlights shortened to fit this page; see the chat for full context.';
    pdf.text(excerpt, 18, y);
  }
  pdf.setFontSize(9); pdf.text('Planning support from historical group data, not an individual clinical decision.', 18, 284);
  pdf.save(`carepath-${group.id}-plan.pdf`);
}
