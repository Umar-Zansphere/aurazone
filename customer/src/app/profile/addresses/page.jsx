'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Header from '@/app/components/Header';
import LoginPrompt from '@/components/LoginPrompt';
import { addressApi } from '@/lib/api';
import {
  AlertCircle,
  CheckCircle,
  MapPin,
  Edit2,
  Trash2,
  Plus,
  Loader,
  ChevronLeft,
  X,
} from 'lucide-react';

export default function AddressesPage() {
  const router = useRouter();
  const [addresses, setAddresses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(null);

  // Form states
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    addressLine1: '',
    addressLine2: '',
    city: '',
    state: '',
    postalCode: '',
    country: 'India',
    isDefault: false,
  });

  // Fetch addresses on mount
  useEffect(() => {
    fetchAddresses();
  }, []);

  const fetchAddresses = async () => {
    try {
      setLoading(true);

      const response = await addressApi.getAddresses();
      if (response.success || Array.isArray(response)) {
        const addressList = response.success ? response.data : response;
        setAddresses(Array.isArray(addressList) ? addressList : []);
        setError(null);
      } else {
        setError('Failed to load addresses');
      }
    } catch (err) {
      setError(err.message || 'Failed to load addresses');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      phone: '',
      addressLine1: '',
      addressLine2: '',
      city: '',
      state: '',
      postalCode: '',
      country: 'India',
      isDefault: false,
    });
    setEditingId(null);
  };

  const handleEdit = (address) => {
    setFormData(address);
    setEditingId(address.id);
    setShowForm(true);
  };

  const handleAddNew = () => {
    resetForm();
    setShowForm(true);
  };

  const validateForm = () => {
    const { name, phone, addressLine1, city, state, postalCode, country } =
      formData;

    if (
      !name?.trim() ||
      !phone?.trim() ||
      !addressLine1?.trim() ||
      !city?.trim() ||
      !state?.trim() ||
      !postalCode?.trim() ||
      !country?.trim()
    ) {
      setError('All required fields must be filled');
      return false;
    }

    if (phone.length < 10) {
      setError('Phone number must be at least 10 digits');
      return false;
    }

    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      let response;
      if (editingId) {
        // Update address
        response = await addressApi.updateAddress(editingId, formData);
      } else {
        // Create address
        response = await addressApi.createAddress(formData);
      }

      if (response.success) {
        setSuccessMessage(
          editingId ? 'Address updated successfully' : 'Address added successfully'
        );
        setShowForm(false);
        resetForm();
        await fetchAddresses();
        setTimeout(() => setSuccessMessage(''), 3000);
      } else {
        setError(response.message || 'Failed to save address');
      }
    } catch (err) {
      setError(err.message || 'Failed to save address');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (addressId) => {
    if (!window.confirm('Are you sure you want to delete this address?')) {
      return;
    }

    try {
      setDeleting(addressId);
      setError(null);
      const response = await addressApi.deleteAddress(addressId);

      if (response.success) {
        setSuccessMessage('Address deleted successfully');
        await fetchAddresses();
        setTimeout(() => setSuccessMessage(''), 3000);
      } else {
        setError(response.message || 'Failed to delete address');
      }
    } catch (err) {
      setError(err.message || 'Failed to delete address');
    } finally {
      setDeleting(null);
    }
  };

  const handleSetDefault = async (addressId) => {
    try {
      setError(null);
      const response = await addressApi.setDefaultAddress(addressId);

      if (response.success) {
        setSuccessMessage('Default address updated');
        await fetchAddresses();
        setTimeout(() => setSuccessMessage(''), 3000);
      } else {
        setError(response.message || 'Failed to set default address');
      }
    } catch (err) {
      setError(err.message || 'Failed to set default address');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col">
        <Header />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <Loader className="animate-spin mx-auto mb-4 text-[#FF5252]" size={32} />
            <p className="text-slate-600">Loading addresses...</p>
          </div>
        </div>
      </div>
    );
  }

  // Show login prompt if addresses couldn't be loaded (not authenticated)
  if (!loading && addresses.length === 0 && error) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col">
        <Header />
        <LoginPrompt
          title="Manage Your Addresses"
          message="Log in to save and manage your delivery addresses for faster checkout"
          showGuestOption={true}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Header />

      <div className="flex-1 max-w-4xl mx-auto w-full py-8 px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <button
            onClick={() => router.push('/profile')}
            className="text-slate-600 hover:text-slate-800 transition"
          >
            <ChevronLeft size={24} />
          </button>
          <h1 className="text-3xl font-bold text-slate-900">My Addresses</h1>
        </div>

        {/* Alerts */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
            <AlertCircle className="text-red-600 shrink-0 mt-0.5" size={20} />
            <div>
              <p className="text-red-800 font-medium">Error</p>
              <p className="text-red-700 text-sm">{error}</p>
            </div>
          </div>
        )}

        {successMessage && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg flex items-start gap-3">
            <CheckCircle className="text-green-600 shrink-0 mt-0.5" size={20} />
            <p className="text-green-800">{successMessage}</p>
          </div>
        )}

        {/* Add Address Button */}
        {!showForm && (
          <button
            onClick={handleAddNew}
            className="mb-8 bg-[#FF5252] hover:bg-orange-700 text-white px-6 py-3 rounded-2xl font-bold transition flex items-center gap-2"
          >
            <Plus size={20} />
            Add New Address
          </button>
        )}

        {/* Address Form */}
        {showForm && (
          <div className="bg-white rounded-3xl shadow-lg p-8 mb-8 border border-slate-100">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-slate-900">
                {editingId ? 'Edit Address' : 'Add New Address'}
              </h2>
              <button
                onClick={() => {
                  setShowForm(false);
                  resetForm();
                }}
                className="text-slate-500 hover:text-slate-700 transition"
              >
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Name */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Name *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    className="w-full px-4 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#FF5252]"
                    placeholder="e.g., Home, Office"
                    required
                  />
                </div>

                {/* Phone */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Phone *
                  </label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) =>
                      setFormData({ ...formData, phone: e.target.value })
                    }
                    className="w-full px-4 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#FF5252]"
                    placeholder="10-digit phone number"
                    required
                  />
                </div>
              </div>

              {/* Address Line 1 */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Street Address *
                </label>
                <input
                  type="text"
                  value={formData.addressLine1}
                  onChange={(e) =>
                    setFormData({ ...formData, addressLine1: e.target.value })
                  }
                  className="w-full px-4 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#FF5252]"
                  placeholder="House no., building name"
                  required
                />
              </div>

              {/* Address Line 2 */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Apartment, suite, etc. (optional)
                </label>
                <input
                  type="text"
                  value={formData.addressLine2}
                  onChange={(e) =>
                    setFormData({ ...formData, addressLine2: e.target.value })
                  }
                  className="w-full px-4 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#FF5252]"
                  placeholder="Apartment, suite, floor, etc."
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* City */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    City *
                  </label>
                  <input
                    type="text"
                    value={formData.city}
                    onChange={(e) =>
                      setFormData({ ...formData, city: e.target.value })
                    }
                    className="w-full px-4 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#FF5252]"
                    placeholder="City"
                    required
                  />
                </div>

                {/* State */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    State *
                  </label>
                  <input
                    type="text"
                    value={formData.state}
                    onChange={(e) =>
                      setFormData({ ...formData, state: e.target.value })
                    }
                    className="w-full px-4 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#FF5252]"
                    placeholder="State"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Postal Code */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Postal Code *
                  </label>
                  <input
                    type="text"
                    value={formData.postalCode}
                    onChange={(e) =>
                      setFormData({ ...formData, postalCode: e.target.value })
                    }
                    className="w-full px-4 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#FF5252]"
                    placeholder="Postal Code"
                    required
                  />
                </div>

                {/* Country */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Country *
                  </label>
                  <input
                    type="text"
                    value={formData.country}
                    onChange={(e) =>
                      setFormData({ ...formData, country: e.target.value })
                    }
                    className="w-full px-4 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#FF5252]"
                    placeholder="Country"
                    required
                  />
                </div>
              </div>

              {/* Default Address Checkbox */}
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="isDefault"
                  checked={formData.isDefault}
                  onChange={(e) =>
                    setFormData({ ...formData, isDefault: e.target.checked })
                  }
                  className="w-4 h-4 text-[#FF5252] cursor-pointer"
                />
                <label htmlFor="isDefault" className="text-sm text-slate-700 cursor-pointer">
                  Set as default address
                </label>
              </div>

              {/* Buttons */}
              <div className="flex gap-4">
                <button
                  type="submit"
                  disabled={submitting}
                  className="bg-[#FF5252] hover:bg-[#FF5252] disabled:bg-slate-400 text-white px-6 py-2 rounded-xl font-bold transition flex items-center gap-2"
                >
                  {submitting && <Loader className="animate-spin" size={16} />}
                  {submitting ? 'Saving...' : editingId ? 'Update Address' : 'Add Address'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false);
                    resetForm();
                  }}
                  className="bg-slate-200 hover:bg-slate-300 text-slate-800 px-6 py-2 rounded-xl font-bold transition"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Addresses List */}
        {addresses.length === 0 ? (
          <div className="bg-white rounded-3xl shadow p-12 text-center border border-slate-100">
            <MapPin className="mx-auto mb-4 text-slate-400" size={48} />
            <h3 className="text-lg font-semibold text-slate-900 mb-2">No Addresses Yet</h3>
            <p className="text-slate-600 mb-6">Add your first address to get started</p>
            <button
              onClick={handleAddNew}
              className="bg-[#FF5252] hover:bg-[#FF5252] text-white px-6 py-2 rounded-xl font-bold transition inline-flex items-center gap-2"
            >
              <Plus size={20} />
              Add Address
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {addresses.map((address) => (
              <div
                key={address.id}
                className={`bg-white rounded-3xl shadow-md p-6 border-2 transition ${address.isDefault ? 'border-[#FF5252] bg-orange-50' : 'border-slate-200 hover:border-slate-300'
                  }`}
              >
                {/* Default Badge */}
                {address.isDefault && (
                  <div className="mb-3 inline-block bg-[#FF5252] text-white text-xs font-bold px-3 py-1 rounded-full">
                    Default
                  </div>
                )}

                {/* Address Info */}
                <div className="mb-4">
                  <h3 className="text-lg font-bold text-slate-900 mb-3 flex items-center gap-2">
                    <MapPin size={20} className="text-[#FF5252]" />
                    {address.name}
                  </h3>

                  <div className="text-sm text-slate-700 space-y-1">
                    <p>{address.addressLine1}</p>
                    {address.addressLine2 && <p>{address.addressLine2}</p>}
                    <p>
                      {address.city}, {address.state} {address.postalCode}
                    </p>
                    <p>{address.country}</p>
                    <p className="pt-2 font-bold">📞 {address.phone}</p>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2 pt-4 border-t border-slate-200">
                  <button
                    onClick={() => handleEdit(address)}
                    className="flex-1 bg-[#FF5252] hover:bg-[#FF5252] text-white py-2 rounded-xl font-bold transition flex items-center justify-center gap-2"
                  >
                    <Edit2 size={16} />
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(address.id)}
                    disabled={deleting === address.id}
                    className="flex-1 bg-red-600 hover:bg-red-700 disabled:bg-slate-400 text-white py-2 rounded-xl font-bold transition flex items-center justify-center gap-2"
                  >
                    {deleting === address.id ? (
                      <Loader className="animate-spin" size={16} />
                    ) : (
                      <>
                        <Trash2 size={16} />
                        Delete
                      </>
                    )}
                  </button>
                  {!address.isDefault && (
                    <button
                      onClick={() => handleSetDefault(address.id)}
                      className="flex-1 bg-slate-200 hover:bg-slate-300 text-slate-900 py-2 rounded-xl font-bold transition"
                    >
                      Set Default
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
