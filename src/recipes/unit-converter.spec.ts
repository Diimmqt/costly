import { BadRequestException } from '@nestjs/common';
import { MaterialUnit } from '../../generated/prisma/enums.js';
import {
  areUnitsCompatible,
  convertUnitQuantity,
  getUnitDimension,
} from './unit-converter.js';

describe('UnitConverter', () => {
  it('should identify unit dimensions and compatibility accurately', () => {
    expect(getUnitDimension(MaterialUnit.GRAM)).toBe('MASS');
    expect(getUnitDimension(MaterialUnit.KILOGRAM)).toBe('MASS');
    expect(getUnitDimension(MaterialUnit.MILLILITER)).toBe('VOLUME');
    expect(getUnitDimension(MaterialUnit.LITER)).toBe('VOLUME');
    expect(getUnitDimension(MaterialUnit.PIECE)).toBe('COUNT');
    expect(getUnitDimension(MaterialUnit.DOZEN)).toBe('COUNT');

    expect(areUnitsCompatible(MaterialUnit.GRAM, MaterialUnit.KILOGRAM)).toBe(
      true,
    );
    expect(
      areUnitsCompatible(MaterialUnit.MILLILITER, MaterialUnit.LITER),
    ).toBe(true);
    expect(areUnitsCompatible(MaterialUnit.DOZEN, MaterialUnit.PIECE)).toBe(
      true,
    );
    expect(
      areUnitsCompatible(MaterialUnit.GRAM, MaterialUnit.MILLILITER),
    ).toBe(false);
    expect(areUnitsCompatible(MaterialUnit.BOTTLE, MaterialUnit.LITER)).toBe(
      false,
    );
  });

  it('should convert mass units (GRAM <-> KILOGRAM) with Decimal precision', () => {
    const gToKg = convertUnitQuantity(
      15,
      MaterialUnit.GRAM,
      MaterialUnit.KILOGRAM,
    );
    expect(Number(gToKg.convertedQuantity)).toBe(0.015);
    expect(gToKg.convertedQuantity.toString()).toBe('0.015');

    const kgToG = convertUnitQuantity(
      1.25,
      MaterialUnit.KILOGRAM,
      MaterialUnit.GRAM,
    );
    expect(Number(kgToG.convertedQuantity)).toBe(1250);
  });

  it('should convert volume units (MILLILITER <-> LITER) with Decimal precision', () => {
    const mlToL = convertUnitQuantity(
      150,
      MaterialUnit.MILLILITER,
      MaterialUnit.LITER,
    );
    expect(Number(mlToL.convertedQuantity)).toBe(0.15);

    const lToMl = convertUnitQuantity(
      2.5,
      MaterialUnit.LITER,
      MaterialUnit.MILLILITER,
    );
    expect(Number(lToMl.convertedQuantity)).toBe(2500);
  });

  it('should convert count units (DOZEN <-> PIECE / PCS) with Decimal precision', () => {
    const dozenToPiece = convertUnitQuantity(
      1,
      MaterialUnit.DOZEN,
      MaterialUnit.PIECE,
    );
    expect(Number(dozenToPiece.convertedQuantity)).toBe(12);

    const pieceToDozen = convertUnitQuantity(
      3,
      MaterialUnit.PIECE,
      MaterialUnit.DOZEN,
    );
    expect(Number(pieceToDozen.convertedQuantity)).toBe(0.25);

    const pcsToPiece = convertUnitQuantity(
      5,
      MaterialUnit.PCS,
      MaterialUnit.PIECE,
    );
    expect(Number(pcsToPiece.convertedQuantity)).toBe(5);
  });

  it('should reject cross-dimension unit conversions (e.g., GRAM -> MILLILITER, KILOGRAM -> LITER)', () => {
    expect(() =>
      convertUnitQuantity(100, MaterialUnit.GRAM, MaterialUnit.MILLILITER),
    ).toThrow(BadRequestException);

    expect(() =>
      convertUnitQuantity(1, MaterialUnit.KILOGRAM, MaterialUnit.LITER),
    ).toThrow(BadRequestException);

    expect(() =>
      convertUnitQuantity(2, MaterialUnit.GRAM, MaterialUnit.PIECE),
    ).toThrow(BadRequestException);

    expect(() =>
      convertUnitQuantity(1, MaterialUnit.BOTTLE, MaterialUnit.MILLILITER),
    ).toThrow(BadRequestException);
  });

  it('should reject zero or negative quantities', () => {
    expect(() =>
      convertUnitQuantity(0, MaterialUnit.GRAM, MaterialUnit.GRAM),
    ).toThrow(BadRequestException);

    expect(() =>
      convertUnitQuantity(-10, MaterialUnit.GRAM, MaterialUnit.KILOGRAM),
    ).toThrow(BadRequestException);
  });
});
