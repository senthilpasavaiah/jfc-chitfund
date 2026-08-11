export type Role = 'ADMIN' | 'MANAGER' | 'COLLECTOR' | 'MEMBER';

export interface User {
  id: string;
  email: string | null;
  phone: string;
  role: Role;
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

export type ChitStatus = 'DRAFT' | 'ACTIVE' | 'CLOSED' | 'CANCELLED';

export interface Chit {
  id: string;
  refNumber: string;
  name: string;
  chitValue: number;
  totalMonths: number;
  monthlyInstallment: number;
  commissionPercent: number;
  startDate: string | null;
  endDate: string | null;
  status: ChitStatus;
}

export interface ChitMemberSummary {
  id: string;
  memberId: string;
  name: string;
  mobileNumber: string;
  slotNumber: number | null;
  isActive: boolean;
}

export interface AuctionSummary {
  id: string;
  monthNumber: number;
  scheduledDate: string;
  status: 'SCHEDULED' | 'COMPLETED' | 'CANCELLED';
  winnerId: string | null;
  discountAmount: number | null;
  dividendPerMember: number | null;
  organizerCommission: number | null;
}

export interface ChitDetail extends Chit {
  members: ChitMemberSummary[];
  auctions: AuctionSummary[];
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
