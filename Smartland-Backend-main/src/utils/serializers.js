export const formatPrefixedId = (prefix, value) => `${prefix}${String(value).padStart(3, '0')}`;

export const parseDbId = (value) => {
  if (typeof value === 'number') return value;
  if (!value) return null;
  const match = String(value).match(/(\d+)$/);
  return match ? Number(match[1]) : Number(value);
};

export const serializeUser = (row) => {
  const profile = row.profile || {};
  const reputation = row.reputation || {};

  return {
    id: formatPrefixedId('U', row.id),
    dbId: row.id,
    name: row.full_name,
    email: row.email,
    role: row.role,
    walletAddress: row.wallet_address || '',
    verificationStatus: row.verification_status,
    country: row.country || profile.country || 'GH',
    phoneNumber: row.phone_number || profile.phone || '',
    organization: row.organization || '',
    profile: {
      phone: profile.phone || row.phone_number || '',
      address: profile.address || '',
      city: profile.city || '',
      state: profile.state || '',
      country: profile.country || row.country || 'GH',
      postalCode: profile.postalCode || '',
      dateOfBirth: profile.dateOfBirth || '',
      nationalId: profile.nationalId || row.national_id || '',
      bio: profile.bio || '',
      avatar: profile.avatar || '',
    },
    reputation: {
      score: reputation.score ?? 50,
      totalTransactions: reputation.totalTransactions ?? 0,
      successfulTransactions: reputation.successfulTransactions ?? 0,
      disputesWon: reputation.disputesWon ?? 0,
      disputesLost: reputation.disputesLost ?? 0,
      communityVotes: reputation.communityVotes ?? 0,
      lastUpdated: reputation.lastUpdated || row.updated_at || new Date().toISOString(),
    },
    joinedDate: row.joined_date || row.created_at,
    lastActive: row.last_active || row.updated_at || row.created_at,
  };
};

export const serializeLand = (row) => ({
  id: formatPrefixedId('LP', row.id),
  dbId: row.id,
  title: row.land_name,
  description: row.description || '',
  owner: row.owner_name || row.owner || '',
  ownerId: row.owner_id ? formatPrefixedId('U', row.owner_id) : undefined,
  location: {
    address: row.location,
    coordinates: row.coordinates || { lat: 5.6037, lng: -0.1870 },
  },
  area: Number(row.size),
  registrationDate: row.created_at,
  lastTransfer: row.last_transfer || row.updated_at || row.created_at,
  value: Number(row.estimated_value || 0),
  status: row.status || 'active',
  documents: row.documents || [],
  blockchainHash: row.blockchain_hash || '',
  landType: row.land_type || '',
});

export const serializeTransfer = (row) => ({
  id: formatPrefixedId('T', row.id),
  dbId: row.id,
  landParcelId: formatPrefixedId('LP', row.land_id),
  from: row.from_owner_name || row.from_name || '',
  to: row.to_owner_name || row.to_name || '',
  amount: Number(row.amount || 0),
  status: row.status || 'pending',
  initiatedDate: row.initiated_date || row.transfer_date || row.created_at,
  completedDate: row.completed_date || undefined,
  escrowHash: row.escrow_hash || undefined,
  transferReason: row.transfer_reason || '',
});

export const serializeDispute = (row) => ({
  id: formatPrefixedId('D', row.id),
  dbId: row.id,
  landParcelId: formatPrefixedId('LP', row.land_id),
  plaintiff: row.plaintiff_name,
  defendant: row.defendant_name,
  description: row.description,
  evidence: row.evidence || [],
  status: row.status,
  filedDate: row.filed_date || row.created_at,
  resolution: row.resolution || undefined,
  votes: {
    support: row.votes?.support ?? 0,
    against: row.votes?.against ?? 0,
    abstain: row.votes?.abstain ?? 0,
  },
  arbitrator: row.arbitrator || undefined,
});
