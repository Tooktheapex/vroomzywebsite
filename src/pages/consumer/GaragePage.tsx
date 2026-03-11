import React, { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Car, CreditCard as Edit2, Trash2, X, Camera, ImagePlus, ChevronDown, ChevronUp, FileText } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { Vehicle, VehiclePhoto, VehicleServiceRecord } from '../../lib/database.types';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '../../components/ui/Button';
import { Input, TextArea, Select } from '../../components/ui/Input';
import { EmptyState } from '../../components/ui/EmptyState';
import { CardSkeleton } from '../../components/ui/LoadingSpinner';
import { uploadVehiclePhoto, deleteStorageFile } from '../../lib/storage';
import { ServiceRecordUploadModal } from '../../components/ui/ServiceRecordUploadModal';
import { ServiceRecordList } from '../../components/ui/ServiceRecordList';

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 40 }, (_, i) => ({ value: String(CURRENT_YEAR - i), label: String(CURRENT_YEAR - i) }));

const COLORS = ['Black','White','Silver','Gray','Red','Blue','Green','Brown','Gold','Orange','Yellow','Purple','Other'];

interface VehicleFormData {
  year: string;
  make: string;
  model: string;
  trim: string;
  color: string;
  mileage: string;
  vin: string;
  plate: string;
  notes: string;
}

const emptyForm: VehicleFormData = {
  year: '', make: '', model: '', trim: '', color: '',
  mileage: '', vin: '', plate: '', notes: '',
};

type VehicleTab = 'photos' | 'history';

interface VehicleWithPhotos extends Vehicle {
  photos: VehiclePhoto[];
  serviceRecords: VehicleServiceRecord[];
  expanded: boolean;
  activeTab: VehicleTab;
}

export function GaragePage() {
  const { user } = useAuth();
  const [vehicles, setVehicles] = useState<VehicleWithPhotos[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editVehicle, setEditVehicle] = useState<Vehicle | null>(null);
  const [form, setForm] = useState<VehicleFormData>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [uploadingFor, setUploadingFor] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [serviceRecordModal, setServiceRecordModal] = useState<{ vehicle: VehicleWithPhotos } | null>(null);
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const fetchVehicles = async () => {
    if (!user) return;
    const [vehicleRes, photoRes, recordRes] = await Promise.all([
      supabase.from('vehicles').select('*').eq('user_id', user.id).order('year', { ascending: false }),
      supabase.from('vehicle_photos').select('*').eq('user_id', user.id).order('sort_order', { ascending: true }),
      supabase.from('vehicle_service_records')
        .select('*')
        .eq('uploaded_by_user_id', user.id)
        .order('service_date', { ascending: false }),
    ]);

    const vehicleData = vehicleRes.data ?? [];
    const photoData = photoRes.data ?? [];
    const recordData = recordRes.data ?? [];

    const photosByVehicle: Record<string, VehiclePhoto[]> = {};
    for (const photo of photoData) {
      if (!photosByVehicle[photo.vehicle_id]) photosByVehicle[photo.vehicle_id] = [];
      photosByVehicle[photo.vehicle_id].push(photo);
    }

    const recordsByVehicle: Record<string, VehicleServiceRecord[]> = {};
    for (const record of recordData) {
      if (record.vehicle_id) {
        if (!recordsByVehicle[record.vehicle_id]) recordsByVehicle[record.vehicle_id] = [];
        recordsByVehicle[record.vehicle_id].push(record);
      }
    }

    setVehicles(vehicleData.map((v) => ({
      ...v,
      photos: photosByVehicle[v.id] ?? [],
      serviceRecords: recordsByVehicle[v.id] ?? [],
      expanded: false,
      activeTab: 'photos' as VehicleTab,
    })));
    setLoading(false);
  };

  useEffect(() => { fetchVehicles(); }, [user]);

  const openAdd = () => { setEditVehicle(null); setForm(emptyForm); setError(''); setShowModal(true); };
  const openEdit = (v: Vehicle) => {
    setEditVehicle(v);
    setForm({
      year: String(v.year ?? ''),
      make: v.make ?? '',
      model: v.model ?? '',
      trim: v.trim ?? '',
      color: v.color ?? '',
      mileage: String(v.mileage ?? ''),
      vin: v.vin ?? '',
      plate: v.plate ?? '',
      notes: v.notes ?? '',
    });
    setError('');
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!form.make || !form.model) { setError('Make and Model are required.'); return; }
    setSaving(true);
    setError('');

    const payload = {
      year: form.year ? parseInt(form.year) : null,
      make: form.make,
      model: form.model,
      trim: form.trim || null,
      color: form.color || null,
      mileage: form.mileage ? parseInt(form.mileage) : null,
      vin: form.vin ? form.vin.toUpperCase().trim() : null,
      plate: form.plate || null,
      notes: form.notes || null,
    };

    if (editVehicle) {
      const { error: err } = await supabase.from('vehicles').update(payload).eq('id', editVehicle.id);
      if (err) { setError(err.message); setSaving(false); return; }
    } else {
      const { error: err } = await supabase.from('vehicles').insert({ ...payload, user_id: user.id });
      if (err) { setError(err.message); setSaving(false); return; }
    }

    setSaving(false);
    setShowModal(false);
    fetchVehicles();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Remove this vehicle from your garage?')) return;
    await supabase.from('vehicles').delete().eq('id', id);
    fetchVehicles();
  };

  const toggleExpand = (vehicleId: string) => {
    setVehicles((prev) =>
      prev.map((v) => v.id === vehicleId ? { ...v, expanded: !v.expanded } : v)
    );
    setUploadError(null);
  };

  const setTab = (vehicleId: string, tab: VehicleTab) => {
    setVehicles((prev) =>
      prev.map((v) => v.id === vehicleId ? { ...v, activeTab: tab, expanded: true } : v)
    );
  };

  const handlePhotoUpload = async (vehicleId: string, files: FileList | null) => {
    if (!files || !user) return;
    setUploadingFor(vehicleId);
    setUploadError(null);

    for (const file of Array.from(files)) {
      const result = await uploadVehiclePhoto(user.id, vehicleId, file);
      if (result.error) {
        setUploadError(result.error);
        setUploadingFor(null);
        return;
      }
      const vehicle = vehicles.find((v) => v.id === vehicleId);
      const sortOrder = (vehicle?.photos.length ?? 0);
      await supabase.from('vehicle_photos').insert({
        vehicle_id: vehicleId,
        user_id: user.id,
        image_url: result.url,
        storage_path: result.path,
        sort_order: sortOrder,
      });
    }

    setUploadingFor(null);
    fetchVehicles();
  };

  const handleDeletePhoto = async (photo: VehiclePhoto) => {
    if (!confirm('Remove this photo?')) return;
    await supabase.from('vehicle_photos').delete().eq('id', photo.id);
    await deleteStorageFile('vehicle-photos', photo.storage_path);
    fetchVehicles();
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-zinc-100">My Garage</h2>
          <p className="text-sm text-zinc-500">Manage your vehicles, photos, and service history</p>
        </div>
        <Button onClick={openAdd} size="sm">
          <Plus size={15} /> Add Vehicle
        </Button>
      </div>

      {loading ? (
        <div className="grid sm:grid-cols-2 gap-4">
          {[0, 1].map((i) => <CardSkeleton key={i} />)}
        </div>
      ) : vehicles.length === 0 ? (
        <EmptyState
          icon={<Car size={24} />}
          title="Your garage is empty"
          description="Add your first vehicle to keep track of service history and speed up booking requests."
          action={<Button onClick={openAdd}><Plus size={15} /> Add Vehicle</Button>}
        />
      ) : (
        <div className="space-y-4">
          {vehicles.map((v) => (
            <motion.div
              key={v.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-zinc-900 rounded-2xl border border-zinc-800 shadow-sm overflow-hidden"
            >
              {/* Vehicle header */}
              <div className="p-5 flex gap-4">
                <div className="w-10 h-10 rounded-xl bg-blue-900/40 flex items-center justify-center shrink-0">
                  <Car size={18} className="text-blue-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-zinc-100">{[v.year, v.make, v.model].filter(Boolean).join(' ')}</h3>
                  <div className="text-xs text-zinc-500 mt-0.5 space-x-2">
                    {v.trim && <span>{v.trim}</span>}
                    {v.color && <span>{v.color}</span>}
                    {v.mileage && <span>{v.mileage.toLocaleString()} mi</span>}
                    {v.vin && <span className="font-mono">VIN: {v.vin}</span>}
                  </div>
                  {v.plate && <p className="text-xs text-zinc-500 mt-1">Plate: {v.plate}</p>}
                </div>
                <div className="flex gap-1 shrink-0 items-start flex-wrap justify-end">
                  <button
                    onClick={() => { setTab(v.id, 'photos'); if (!v.expanded || v.activeTab === 'photos') toggleExpand(v.id); }}
                    className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg transition-colors text-xs font-medium ${
                      v.expanded && v.activeTab === 'photos'
                        ? 'bg-blue-900/40 text-blue-400'
                        : 'hover:bg-blue-900/40 text-zinc-500 hover:text-blue-400'
                    }`}
                  >
                    <Camera size={13} />
                    <span>{v.photos.length}</span>
                  </button>
                  <button
                    onClick={() => { setTab(v.id, 'history'); if (!v.expanded || v.activeTab === 'history') toggleExpand(v.id); }}
                    className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg transition-colors text-xs font-medium ${
                      v.expanded && v.activeTab === 'history'
                        ? 'bg-blue-900/40 text-blue-400'
                        : 'hover:bg-blue-900/40 text-zinc-500 hover:text-blue-400'
                    }`}
                  >
                    <FileText size={13} />
                    <span>{v.serviceRecords.length}</span>
                  </button>
                  <button onClick={() => openEdit(v)} className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-500 hover:text-zinc-300 transition-colors">
                    <Edit2 size={14} />
                  </button>
                  <button onClick={() => handleDelete(v.id)} className="p-1.5 rounded-lg hover:bg-red-950/50 text-zinc-500 hover:text-red-400 transition-colors">
                    <Trash2 size={14} />
                  </button>
                  <button
                    onClick={() => toggleExpand(v.id)}
                    className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-500 hover:text-zinc-400 transition-colors"
                  >
                    {v.expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </button>
                </div>
              </div>

              {/* Expandable panel */}
              <AnimatePresence>
                {v.expanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden border-t border-zinc-900"
                  >
                    {/* Tab bar */}
                    <div className="flex border-b border-zinc-900 bg-zinc-950">
                      <button
                        onClick={() => setTab(v.id, 'photos')}
                        className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold transition-colors ${
                          v.activeTab === 'photos'
                            ? 'text-blue-400 border-b-2 border-blue-400 bg-zinc-900 -mb-px'
                            : 'text-zinc-500 hover:text-zinc-300'
                        }`}
                      >
                        <Camera size={12} /> Photos ({v.photos.length})
                      </button>
                      <button
                        onClick={() => setTab(v.id, 'history')}
                        className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold transition-colors ${
                          v.activeTab === 'history'
                            ? 'text-blue-400 border-b-2 border-blue-400 bg-zinc-900 -mb-px'
                            : 'text-zinc-500 hover:text-zinc-300'
                        }`}
                      >
                        <FileText size={12} /> Service History ({v.serviceRecords.length})
                      </button>
                    </div>

                    {/* Photos tab */}
                    {v.activeTab === 'photos' && (
                      <div className="p-5 bg-zinc-950">
                        <div className="flex items-center justify-between mb-3">
                          <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">Photos</p>
                          <div>
                            <input
                              ref={(el) => { fileInputRefs.current[v.id] = el; }}
                              type="file"
                              accept="image/jpeg,image/png,image/webp,image/gif"
                              multiple
                              className="hidden"
                              onChange={(e) => handlePhotoUpload(v.id, e.target.files)}
                            />
                            <button
                              onClick={() => fileInputRefs.current[v.id]?.click()}
                              disabled={uploadingFor === v.id}
                              className="flex items-center gap-1.5 text-xs font-medium text-blue-400 hover:text-blue-300 disabled:opacity-50 transition-colors"
                            >
                              <ImagePlus size={14} />
                              {uploadingFor === v.id ? 'Uploading...' : 'Add Photos'}
                            </button>
                          </div>
                        </div>

                        {uploadError && (
                          <p className="text-xs text-red-400 bg-red-950/50 px-3 py-2 rounded-lg mb-3">{uploadError}</p>
                        )}

                        {v.photos.length === 0 ? (
                          <button
                            onClick={() => fileInputRefs.current[v.id]?.click()}
                            className="w-full border-2 border-dashed border-zinc-800 rounded-xl p-8 flex flex-col items-center gap-2 text-zinc-500 hover:border-blue-800 hover:text-blue-400 transition-colors"
                          >
                            <Camera size={24} />
                            <span className="text-sm">Upload photos of your vehicle</span>
                            <span className="text-xs">JPG, PNG, WebP up to 8MB</span>
                          </button>
                        ) : (
                          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
                            {v.photos.map((photo) => (
                              <div key={photo.id} className="relative group aspect-square rounded-xl overflow-hidden bg-zinc-800">
                                <img
                                  src={photo.image_url}
                                  alt={photo.caption ?? 'Vehicle photo'}
                                  className="w-full h-full object-cover"
                                />
                                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                                  <button
                                    onClick={() => handleDeletePhoto(photo)}
                                    className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 bg-red-600 rounded-lg text-white"
                                  >
                                    <Trash2 size={12} />
                                  </button>
                                </div>
                              </div>
                            ))}
                            <button
                              onClick={() => fileInputRefs.current[v.id]?.click()}
                              disabled={uploadingFor === v.id}
                              className="aspect-square rounded-xl border-2 border-dashed border-zinc-800 flex flex-col items-center justify-center gap-1 text-zinc-500 hover:border-blue-800 hover:text-blue-400 transition-colors disabled:opacity-50"
                            >
                              <Plus size={18} />
                              <span className="text-xs">Add</span>
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Service History tab */}
                    {v.activeTab === 'history' && (
                      <div className="p-5 bg-zinc-950">
                        <div className="flex items-center justify-between mb-3">
                          <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">Service History</p>
                          {v.vin ? (
                            <button
                              onClick={() => setServiceRecordModal({ vehicle: v })}
                              className="flex items-center gap-1.5 text-xs font-medium text-blue-400 hover:text-blue-300 transition-colors"
                            >
                              <Plus size={14} /> Upload Record
                            </button>
                          ) : (
                            <span className="text-xs text-zinc-500">Add VIN to enable records</span>
                          )}
                        </div>

                        {!v.vin && (
                          <div className="mb-3 p-3 bg-amber-900/50 border border-amber-800 rounded-xl text-xs text-amber-300">
                            Add a VIN to this vehicle to enable VIN-linked service record tracking.
                            <button
                              onClick={() => openEdit(v)}
                              className="ml-1 font-semibold underline hover:no-underline"
                            >
                              Edit vehicle
                            </button>
                          </div>
                        )}

                        <ServiceRecordList
                          records={v.serviceRecords}
                          emptyMessage="No service records yet. Upload a PDF or photo of a receipt, invoice, or inspection report."
                        />
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </div>
      )}

      {/* Vehicle Add/Edit Modal */}
      <AnimatePresence>
        {showModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.95, y: 16 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 16 }}
              className="bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between p-6 border-b border-zinc-900">
                <h2 className="font-bold text-zinc-100">{editVehicle ? 'Edit Vehicle' : 'Add Vehicle'}</h2>
                <button onClick={() => setShowModal(false)} className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-500">
                  <X size={16} />
                </button>
              </div>
              <form onSubmit={handleSave} className="p-6 space-y-4">
                {error && <p className="text-sm text-red-400 bg-red-950/50 px-3 py-2 rounded-lg">{error}</p>}
                <div className="grid grid-cols-3 gap-3">
                  <Select label="Year" value={form.year} onChange={(e) => setForm({ ...form, year: e.target.value })} options={YEARS} placeholder="Year" />
                  <Input label="Make" placeholder="Toyota" value={form.make} onChange={(e) => setForm({ ...form, make: e.target.value })} required />
                  <Input label="Model" placeholder="Camry" value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} required />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Input label="Trim" placeholder="XSE" value={form.trim} onChange={(e) => setForm({ ...form, trim: e.target.value })} />
                  <Select label="Color" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} options={COLORS.map((c) => ({ value: c, label: c }))} placeholder="Color" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Input label="Mileage" type="number" placeholder="45000" value={form.mileage} onChange={(e) => setForm({ ...form, mileage: e.target.value })} />
                  <Input label="License Plate" placeholder="ABC1234" value={form.plate} onChange={(e) => setForm({ ...form, plate: e.target.value })} />
                </div>
                <Input
                  label="VIN"
                  placeholder="1HGBH41JXMN109186"
                  value={form.vin}
                  onChange={(e) => setForm({ ...form, vin: e.target.value.toUpperCase().trim() })}
                  hint="Required for VIN-linked service record tracking"
                />
                <TextArea label="Notes" placeholder="Any notes about this vehicle..." value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} />
                <div className="flex gap-2 pt-2">
                  <Button type="button" variant="ghost" fullWidth onClick={() => setShowModal(false)}>Cancel</Button>
                  <Button type="submit" fullWidth loading={saving}>{editVehicle ? 'Save Changes' : 'Add Vehicle'}</Button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Service Record Upload Modal */}
      {serviceRecordModal && (
        <ServiceRecordUploadModal
          vehicle={serviceRecordModal.vehicle}
          sourceType="owner_upload"
          onClose={() => setServiceRecordModal(null)}
          onSuccess={() => {
            setServiceRecordModal(null);
            fetchVehicles();
          }}
        />
      )}
    </div>
  );
}
