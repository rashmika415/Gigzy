import React, { createContext, useContext, useState } from 'react';
import { Applicant, ApplicationStatus, MOCK_APPLICANTS } from '../data/mockData';

interface ApplicantsContextType {
  applicants: Applicant[];
  setStatus: (id: string, status: ApplicationStatus) => void;
}

const ApplicantsContext = createContext<ApplicantsContextType>({
  applicants: MOCK_APPLICANTS,
  setStatus: () => {},
});

export function ApplicantsProvider({ children }: { children: React.ReactNode }) {
  const [applicants, setApplicants] = useState<Applicant[]>(MOCK_APPLICANTS);

  const setStatus = (id: string, status: ApplicationStatus) => {
    setApplicants((prev) => prev.map((a) => (a.id === id ? { ...a, status } : a)));
  };

  return (
    <ApplicantsContext.Provider value={{ applicants, setStatus }}>
      {children}
    </ApplicantsContext.Provider>
  );
}

export function useApplicants() {
  return useContext(ApplicantsContext);
}
