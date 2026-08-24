import React, { createContext, useContext, useState } from 'react';
import { BusinessGig, MOCK_BUSINESS_GIGS } from '../data/mockData';

interface BusinessGigsContextType {
  gigs: BusinessGig[];
  addGig: (gig: BusinessGig) => void;
  setGigStatus: (id: string, status: 'open' | 'closed') => void;
}

const BusinessGigsContext = createContext<BusinessGigsContextType>({
  gigs: MOCK_BUSINESS_GIGS,
  addGig: () => {},
  setGigStatus: () => {},
});

export function BusinessGigsProvider({ children }: { children: React.ReactNode }) {
  const [gigs, setGigs] = useState<BusinessGig[]>(MOCK_BUSINESS_GIGS);

  const addGig = (gig: BusinessGig) => setGigs((prev) => [gig, ...prev]);
  const setGigStatus = (id: string, status: 'open' | 'closed') =>
    setGigs((prev) => prev.map((g) => (g.id === id ? { ...g, status } : g)));

  return (
    <BusinessGigsContext.Provider value={{ gigs, addGig, setGigStatus }}>
      {children}
    </BusinessGigsContext.Provider>
  );
}

export function useBusinessGigs() {
  return useContext(BusinessGigsContext);
}
