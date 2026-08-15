export type Role = 'ADMIN' | 'MANAGER' | 'COLLECTOR' | 'MEMBER';

export interface User {
  id: string;
  email: string | null;
  phone: string;
  role: Role;
  name?: string | null;
  memberId?: string | null;
}

export interface Member {
  id: string;
  userId: string | null;
  name: string;
  photoUrl: string | null;
  mobileNumber: string;
  whatsappNumber: string | null;
  email: string | null;
  permanentAddress: string | null;
  currentAddress: string | null;
  aadhaarMasked: string;
  status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
  joinedDate: string;
  notes: string | null;
}

export type ChitStatus = 'upcoming' | 'ongoing' | 'completed';
export type RateSchedule = 'standard' | 'jfc';

export interface Chit {
  id: string;
  refNumber: string;
  valueLakh: number;
  totalMonths: number;
  rateSchedule: RateSchedule;
  startDate: string | null;
  endDate: string | null;
  status: ChitStatus;
  baseMonthly: number;
  commissionPerMonth: number;
  monthsElapsed: number;
  monthsRemaining: number;
  createdAt: string;
}

export interface ChitParticipantSlot {
  slotIndex: number;
  memberId: string | null;
  name: string | null;
  isClub: boolean;
}

export interface ChitMonthSummary {
  monthIndex: number;
  label: string;
  drawnBy: string | null;
  drawnByMemberId: string | null;
  shuffled: boolean;
  paidCount: number;
  capacity: number;
}

export interface ChitDetail extends Chit {
  capacity: number;
  filled: number;
  isFull: boolean;
  isParticipant: boolean;
  participants: ChitParticipantSlot[];
  timeline: ChitMonthSummary[];
}

export interface ChitMonthParticipant {
  memberId: string;
  name: string;
  paid: boolean;
  isDrawer: boolean;
}

export interface ChitMonthRequest {
  memberId: string;
  name: string;
  type: 'mandatory' | 'planning' | 'none';
}

export interface ChitMonthDetail {
  monthIndex: number;
  label: string;
  isClub: boolean;
  drawnByName: string | null;
  drawnByMemberId: string | null;
  shuffled: boolean;
  participants: ChitMonthParticipant[];
  requests: ChitMonthRequest[];
  monthlyPayment: number;
  payout: number;
}

export interface DashboardSummary {
  totalMembers: number;
  activeMembers: number;
  activeChits: number;
  closedChits: number;
  monthlyCollection: number;
  monthlyExpenses: number;
  pendingPayments: { total: number; count: number };
  totalCollection: number;
  totalExpenses: number;
  profit: number;
  incomeViaChit: number;
  incomeViaDonation: number;
  incomeViaSantha: number;
  totalIncome: number;
  currentlyInHand: number;
  accruedProfit: number;
  finalSettlementValue: number;
}
