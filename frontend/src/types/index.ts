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
  /** Present when the list was loaded for a logged-in viewer: whether they hold a slot in this chit. */
  isParticipant?: boolean;
  /** Present when the list was loaded for a logged-in viewer: whether they're allowed to open this chit (Admin/Manager, or a participant). */
  canAccess?: boolean;
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
  slotNumber?: number;
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
  /** True only for the single month that's currently active/actionable - past and future months are locked for Assign/Shuffle. */
  isCurrentMonth: boolean;
  drawnByName: string | null;
  drawnByMemberId: string | null;
  shuffled: boolean;
  participants: ChitMonthParticipant[];
  requests: ChitMonthRequest[];
  monthlyPayment: number;
  payout: number;
}

export interface ManagementSplit {
  boundaryDate: string;
  previousManagement: {
    santha: number;
    donation: number;
    unclassifiedContribution: number;
    chitProfit: number;
    expenses: number;
    principal: number;
    profit: number;
    finalSettlement: number;
    handoverAmount: number;
    handoverDate: string;
    handoverSource: string;
  };
  newManagement: {
    openingBalance: number;
    donations: number;
    santha: number;
    chitIncome: number;
    income: number;
    officeExpenses: number;
    chitExpenses: number;
    expenses: number;
    currentBalance: number;
  };
}

export interface CurrentMonthDrawer {
  chitId: string;
  refNumber: string;
  monthIndex: number;
  monthLabel: string;
  drawerName: string | null;
  assignedVia: 'manual' | 'shuffle' | null;
}

export interface NotificationRow {
  id: string;
  member_id: string | null;
  member_name: string | null;
  channel: 'SMS' | 'WHATSAPP' | 'EMAIL' | 'PUSH';
  type: string;
  subject: string | null;
  body: string;
  status: 'PENDING' | 'LOGGED' | 'FAILED';
  created_at: string;
}

export interface ClubDocument {
  id: string;
  title: string;
  category: 'ACCOUNTS' | 'REGISTRATION' | 'BYLAWS' | 'OTHER';
  description: string | null;
  file_name: string;
  file_mime_type: string;
  uploaded_by_name: string | null;
  uploaded_at: string;
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
  currentMonthDrawers: CurrentMonthDrawer[];
  fundGrowth: { openingBalance: number; series: { month: string; income: number; expenses: number; balance: number }[] };
}
