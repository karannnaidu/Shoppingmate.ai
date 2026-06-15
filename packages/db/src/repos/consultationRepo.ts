import { db } from '../client.js';
import { consultationRequests, type NewConsultationRequest } from '../schema/consultationRequests.js';

export async function createConsultationRequest(values: NewConsultationRequest): Promise<number> {
  const [row] = await db
    .insert(consultationRequests)
    .values(values)
    .returning({ id: consultationRequests.id });
  if (!row) throw new Error('consultation insert returned no row');
  return row.id;
}
