import { BadRequestException } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client.js';
import { MaterialUnit } from '../../generated/prisma/enums.js';

export type UnitDimension = 'MASS' | 'VOLUME' | 'COUNT' | 'SHEET' | 'BOTTLE';

interface UnitDefinition {
  dimension: UnitDimension;
  /** Factor relative to the smallest standard unit in the same dimension. */
  toDimensionBase: Prisma.Decimal;
}

const UNIT_DEFINITIONS: Record<MaterialUnit, UnitDefinition> = {
  [MaterialUnit.GRAM]: {
    dimension: 'MASS',
    toDimensionBase: new Prisma.Decimal(1),
  },
  [MaterialUnit.KILOGRAM]: {
    dimension: 'MASS',
    toDimensionBase: new Prisma.Decimal(1000),
  },
  [MaterialUnit.MILLILITER]: {
    dimension: 'VOLUME',
    toDimensionBase: new Prisma.Decimal(1),
  },
  [MaterialUnit.LITER]: {
    dimension: 'VOLUME',
    toDimensionBase: new Prisma.Decimal(1000),
  },
  [MaterialUnit.PIECE]: {
    dimension: 'COUNT',
    toDimensionBase: new Prisma.Decimal(1),
  },
  [MaterialUnit.PCS]: {
    dimension: 'COUNT',
    toDimensionBase: new Prisma.Decimal(1),
  },
  [MaterialUnit.DOZEN]: {
    dimension: 'COUNT',
    toDimensionBase: new Prisma.Decimal(12),
  },
  [MaterialUnit.SHEET]: {
    dimension: 'SHEET',
    toDimensionBase: new Prisma.Decimal(1),
  },
  [MaterialUnit.BOTTLE]: {
    dimension: 'BOTTLE',
    toDimensionBase: new Prisma.Decimal(1),
  },
};

export interface UnitConversionResult {
  quantity: Prisma.Decimal;
  fromUnit: MaterialUnit;
  toUnit: MaterialUnit;
  dimension: UnitDimension;
  convertedQuantity: Prisma.Decimal;
}

/**
 * Returns the physical/counting dimension of a MaterialUnit.
 */
export function getUnitDimension(unit: MaterialUnit): UnitDimension {
  const def = UNIT_DEFINITIONS[unit];
  if (!def) {
    throw new BadRequestException(`Unsupported material unit '${String(unit)}'`);
  }
  return def.dimension;
}

/**
 * Checks whether two units belong to the same dimension and can be converted safely.
 */
export function areUnitsCompatible(
  fromUnit: MaterialUnit,
  toUnit: MaterialUnit,
): boolean {
  const fromDef = UNIT_DEFINITIONS[fromUnit];
  const toDef = UNIT_DEFINITIONS[toUnit];
  if (!fromDef || !toDef) {
    return false;
  }
  return fromDef.dimension === toDef.dimension;
}

/**
 * Safely converts a positive Decimal quantity from `fromUnit` into `toUnit`.
 * Only allows same-dimension conversions (e.g., GRAM <-> KILOGRAM, MILLILITER <-> LITER,
 * PIECE/PCS <-> DOZEN). Cross-dimension conversions (such as GRAM <-> MILLILITER) are
 * strictly rejected with BadRequestException.
 */
export function convertUnitQuantity(
  quantity: Prisma.Decimal | number | string,
  fromUnit: MaterialUnit,
  toUnit: MaterialUnit,
): UnitConversionResult {
  const qtyDec = new Prisma.Decimal(quantity);

  if (qtyDec.lessThanOrEqualTo(0)) {
    throw new BadRequestException('Usage quantity must be greater than 0');
  }

  const fromDef = UNIT_DEFINITIONS[fromUnit];
  if (!fromDef) {
    throw new BadRequestException(
      `Unsupported usage unit '${String(fromUnit)}'`,
    );
  }

  const toDef = UNIT_DEFINITIONS[toUnit];
  if (!toDef) {
    throw new BadRequestException(
      `Unsupported base unit '${String(toUnit)}'`,
    );
  }

  if (fromDef.dimension !== toDef.dimension) {
    throw new BadRequestException(
      `Cannot convert incompatible units from '${fromUnit}' (${fromDef.dimension}) to '${toUnit}' (${toDef.dimension}). Only same-dimension units can be converted.`,
    );
  }

  if (fromUnit === toUnit) {
    return {
      quantity: qtyDec,
      fromUnit,
      toUnit,
      dimension: fromDef.dimension,
      convertedQuantity: qtyDec.toDecimalPlaces(6, Prisma.Decimal.ROUND_HALF_UP),
    };
  }

  const convertedQuantity = qtyDec
    .mul(fromDef.toDimensionBase)
    .div(toDef.toDimensionBase)
    .toDecimalPlaces(6, Prisma.Decimal.ROUND_HALF_UP);

  return {
    quantity: qtyDec,
    fromUnit,
    toUnit,
    dimension: fromDef.dimension,
    convertedQuantity,
  };
}
