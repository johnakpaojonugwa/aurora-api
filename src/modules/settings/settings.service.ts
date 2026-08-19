import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { UpdateSettingsDto } from './dto/update-settings.dto';
import { UpdateTaxDto } from './dto/update-tax.dto';
import { UpdateShippingDto } from './dto/update-shipping.dto';

const SETTINGS_ID = 'global';

@Injectable()
export class SettingsService {
  constructor(private prisma: PrismaService) {}

  private async getOrCreateSettings() {
    let settings = await this.prisma.systemSettings.findUnique({
      where: { id: SETTINGS_ID },
    });

    if (!settings) {
      settings = await this.prisma.systemSettings.create({
        data: {
          id: SETTINGS_ID,
          storeName: 'Aurora Boutique',
          contactEmail: 'admin@auroraboutique.com',
          defaultCurrency: 'USD',
          taxRates: [],
          shippingRules: [],
          freeShippingThreshold: 100,
        },
      });
    }

    return settings;
  }

  async getSettings() {
    const s = await this.getOrCreateSettings();
    return {
      id: s.id,
      storeName: s.storeName,
      storeLogo: s.storeLogo,
      contactEmail: s.contactEmail,
      contactPhone: s.contactPhone,
      defaultCurrency: s.defaultCurrency,
      taxRates: s.taxRates,
      shippingRules: s.shippingRules,
      freeShippingThreshold: s.freeShippingThreshold ? Number(s.freeShippingThreshold) : null,
    };
  }

  async updateSettings(dto: UpdateSettingsDto) {
    await this.getOrCreateSettings();
    const updated = await this.prisma.systemSettings.update({
      where: { id: SETTINGS_ID },
      data: {
        storeName: dto.storeName,
        storeLogo: dto.storeLogo,
        contactEmail: dto.contactEmail,
        contactPhone: dto.contactPhone,
        defaultCurrency: dto.defaultCurrency,
      },
    });

    return {
      id: updated.id,
      storeName: updated.storeName,
      storeLogo: updated.storeLogo,
      contactEmail: updated.contactEmail,
      contactPhone: updated.contactPhone,
      defaultCurrency: updated.defaultCurrency,
      taxRates: updated.taxRates,
      shippingRules: updated.shippingRules,
      freeShippingThreshold: updated.freeShippingThreshold ? Number(updated.freeShippingThreshold) : null,
    };
  }

  async getTaxSettings() {
    const s = await this.getOrCreateSettings();
    return {
      rates: s.taxRates as any[],
    };
  }

  async updateTaxSettings(dto: UpdateTaxDto) {
    await this.getOrCreateSettings();
    const updated = await this.prisma.systemSettings.update({
      where: { id: SETTINGS_ID },
      data: {
        taxRates: dto.rates as any,
      },
    });
    return {
      rates: updated.taxRates as any[],
    };
  }

  async getShippingSettings() {
    const s = await this.getOrCreateSettings();
    return {
      freeShippingThreshold: s.freeShippingThreshold ? Number(s.freeShippingThreshold) : null,
      rules: s.shippingRules as any[],
    };
  }

  async updateShippingSettings(dto: UpdateShippingDto) {
    await this.getOrCreateSettings();
    const updated = await this.prisma.systemSettings.update({
      where: { id: SETTINGS_ID },
      data: {
        freeShippingThreshold: dto.freeShippingThreshold !== undefined ? dto.freeShippingThreshold : undefined,
        shippingRules: dto.rules as any,
      },
    });
    return {
      freeShippingThreshold: updated.freeShippingThreshold ? Number(updated.freeShippingThreshold) : null,
      rules: updated.shippingRules as any[],
    };
  }
}
