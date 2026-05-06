// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { IdentificationFields } from '../IdentificationFields';
import { EMPTY_FILTERS } from '../../../../hooks/usePlayerFinder';

const baseProps = () => ({
  filters: { ...EMPTY_FILTERS, accessory: { ...EMPTY_FILTERS.accessory } },
  setScalar: vi.fn(),
  setEthnicity: vi.fn(),
  setEthnicityNote: vi.fn(),
  setAccessory: vi.fn(),
  activeTab: 'skin',
  setActiveTab: vi.fn(),
  tabBadges: { skin: 0, hair: 0, beard: 0, accessory: 0 },
});

describe('IdentificationFields — chip rendering + handlers', () => {
  it('renders the three card sections (Identity, Body, Features)', () => {
    render(<IdentificationFields {...baseProps()} />);
    expect(screen.getByText('Identity')).toBeInTheDocument();
    expect(screen.getByText('Body')).toBeInTheDocument();
    expect(screen.getByText('Features')).toBeInTheDocument();
  });

  it('renders sex chips and emits setScalar on click', () => {
    const props = baseProps();
    render(<IdentificationFields {...props} />);
    fireEvent.click(screen.getByRole('button', { name: 'M' }));
    expect(props.setScalar).toHaveBeenCalledWith('sex', 'male');
  });

  it('renders ethnicity chips and emits setEthnicity on click', () => {
    const props = baseProps();
    render(<IdentificationFields {...props} />);
    fireEvent.click(screen.getByRole('button', { name: 'Hispanic' }));
    expect(props.setEthnicity).toHaveBeenCalledWith('hispanic');
  });

  it('renders heritage note input and emits on change', () => {
    const props = baseProps();
    render(<IdentificationFields {...props} />);
    const input = screen.getByPlaceholderText(/Heritage note/);
    fireEvent.change(input, { target: { value: 'Italian' } });
    expect(props.setEthnicityNote).toHaveBeenCalledWith('Italian');
  });

  it('renders Build + Height chips', () => {
    render(<IdentificationFields {...baseProps()} />);
    // Body card has both Build and Height SubLabels
    expect(screen.getByText('Build')).toBeInTheDocument();
    expect(screen.getByText('Height')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Short' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Medium' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tall' })).toBeInTheDocument();
  });

  it('switches Features tabs via setActiveTab', () => {
    const props = baseProps();
    render(<IdentificationFields {...props} />);
    fireEvent.click(screen.getByRole('button', { name: /Hair/ }));
    expect(props.setActiveTab).toHaveBeenCalledWith('hair');
  });

  it('shows the accessory positive-boost hint in filter mode', () => {
    render(<IdentificationFields {...baseProps()} activeTab="accessory" mode="filter" />);
    expect(screen.getByText(/positive boost|boosts results|never excludes/i)).toBeInTheDocument();
  });

  it('does NOT show the positive-boost hint in edit mode', () => {
    render(<IdentificationFields {...baseProps()} activeTab="accessory" mode="edit" />);
    expect(screen.queryByText(/never excludes/i)).not.toBeInTheDocument();
  });

  it('reflects active sex chip when filter has sex set', () => {
    const props = baseProps();
    props.filters.sex = 'female';
    render(<IdentificationFields {...props} />);
    const button = screen.getByRole('button', { name: 'F' });
    expect(button).toHaveAttribute('aria-pressed', 'true');
  });

  it('renders accessory subtype chips when an accessory kind is selected', () => {
    const props = baseProps();
    props.filters.accessory = { kind: 'hat', subtype: null, color: null, note: '' };
    render(<IdentificationFields {...props} activeTab="accessory" />);
    // Subtype chips render in addition to the kind row.
    expect(screen.getByText('Subtype')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cap' })).toBeInTheDocument();
  });

  it('renders accessory note input when a kind is selected', () => {
    const props = baseProps();
    props.filters.accessory = { kind: 'hat', subtype: null, color: null, note: '' };
    render(<IdentificationFields {...props} activeTab="accessory" />);
    const input = screen.getByPlaceholderText(/KC Royals|WSOP|free-text/);
    fireEvent.change(input, { target: { value: 'KC Royals' } });
    expect(props.setAccessory).toHaveBeenCalledWith({ note: 'KC Royals' });
  });

  it('badge shows count for a tab with active filters', () => {
    const props = baseProps();
    props.tabBadges = { skin: 1, hair: 2, beard: 0, accessory: 0 };
    render(<IdentificationFields {...props} />);
    // The Hair tab button should contain a "2" badge.
    const hairBtn = screen.getByRole('button', { name: /Hair/ });
    expect(within(hairBtn).getByText('2')).toBeInTheDocument();
  });
});
