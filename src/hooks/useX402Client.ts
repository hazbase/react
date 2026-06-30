import { useContext } from 'react';
import { HazbaseX402Context } from '../context/HazbaseX402Context';

export function useX402Client() {
  const ctx = useContext(HazbaseX402Context);
  if (!ctx) throw new Error('HazbaseX402Provider is missing');
  return ctx.client;
}
