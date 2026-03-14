import { useMemo, useState } from 'react';
import { planBelt } from '../domain/planner';
import { PlannerInput } from '../types';

export function useBeltPlanner(initialInput: PlannerInput) {
  const [input, setInput] = useState<PlannerInput>(initialInput);
  const [version, setVersion] = useState(0);

  const result = useMemo(() => planBelt(input), [input, version]);

  return {
    input,
    setInput,
    recalculate: () => setVersion((value) => value + 1),
    result
  };
}
