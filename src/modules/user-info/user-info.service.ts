import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { CreatePersonaNaturalBillingDto, CreatePersonaJuridicaBillingDto } from './dto/user-info-billing.dto.js';

@Injectable()
export class UserInfoService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Fetches the active billing configuration profile of a user.
   * A user can have at most one profile configured across all types.
   */
  async getBillingProfile(userId: string) {
    const [natural, juridica] = await Promise.all([
      this.prisma.personaNaturalBilling.findUnique({ where: { userId } }),
      this.prisma.personaJuridicaBilling.findUnique({ where: { userId } }),
    ]);

    if (natural) {
      return { type: 'NATURAL', data: natural };
    }
    if (juridica) {
      return { type: 'JURIDICA', data: juridica };
    }
    return null;
  }

  /**
   * Enforces the constraint: "Only one billing info profile per user".
   * Throws BadRequestException if any profile is already configured.
   */
  private async checkExistingProfile(userId: string) {
    const profile = await this.getBillingProfile(userId);
    if (profile) {
      throw new BadRequestException('El usuario ya cuenta con un perfil de facturación configurado (no se permiten perfiles múltiples)');
    }
  }

  /**
   * Configures a new Natural Person billing details record.
   */
  async createPersonaNatural(userId: string, dto: CreatePersonaNaturalBillingDto) {
    // Check constraint
    await this.checkExistingProfile(userId);

    return this.prisma.personaNaturalBilling.create({
      data: {
        userId,
        tipoDocumento: dto.tipoDocumento,
        numeroDocumento: dto.numeroDocumento,
        primerNombre: dto.primerNombre,
        primerApellido: dto.primerApellido,
        tipoPersonaNacionalidad: dto.tipoPersonaNacionalidad,
        responsabilidadesFiscales: dto.responsabilidadesFiscales,
        regimenTributario: dto.regimenTributario,
        regimenFiscalIva: dto.regimenFiscalIva,
        correoElectronicoRut: dto.correoElectronicoRut,
        direccion: dto.direccion,
        departamento: dto.departamento,
        municipio: dto.municipio,
        certificadoFirma: dto.certificadoFirma,
        modoOperacion: dto.modoOperacion,
        prefijoNumeracion: dto.prefijoNumeracion,
        rangoDesde: dto.rangoDesde,
        rangoHasta: dto.rangoHasta,
        resolucionDian: dto.resolucionDian,
        fechaResolucion: new Date(dto.fechaResolucion),
        fechaVigencia: new Date(dto.fechaVigencia),
      },
    });
  }

  /**
   * Configures a new Legal Person (Company) billing details record.
   */
  async createPersonaJuridica(userId: string, dto: CreatePersonaJuridicaBillingDto) {
    // Check constraint
    await this.checkExistingProfile(userId);

    return this.prisma.personaJuridicaBilling.create({
      data: {
        userId,
        tipoDocumento: dto.tipoDocumento,
        numeroNit: dto.numeroNit,
        digitoVerificacion: dto.digitoVerificacion,
        razonSocial: dto.razonSocial,
        tipoOrganizacion: dto.tipoOrganizacion,
        codigoCiiu: dto.codigoCiiu,
        repLegalTipoDoc: dto.repLegalTipoDoc,
        repLegalNumeroDoc: dto.repLegalNumeroDoc,
        repLegalNombres: dto.repLegalNombres,
        repLegalApellidos: dto.repLegalApellidos,
        repLegalEmail: dto.repLegalEmail,
        responsabilidadesFiscales: dto.responsabilidadesFiscales,
        regimenTributario: dto.regimenTributario,
        regimenFiscalIva: dto.regimenFiscalIva,
        correoElectronicoRut: dto.correoElectronicoRut,
        direccion: dto.direccion,
        departamento: dto.departamento,
        municipio: dto.municipio,
        certificadoFirma: dto.certificadoFirma,
        modoOperacion: dto.modoOperacion,
        prefijoNumeracion: dto.prefijoNumeracion,
        rangoDesde: dto.rangoDesde,
        rangoHasta: dto.rangoHasta,
        resolucionDian: dto.resolucionDian,
        fechaResolucion: new Date(dto.fechaResolucion),
        fechaVigencia: new Date(dto.fechaVigencia),
      },
    });
  }

  /**
   * Removes any active billing profile for the user.
   */
  async deleteBillingProfile(userId: string) {
    const profile = await this.getBillingProfile(userId);
    if (!profile) {
      throw new NotFoundException('No se encontró ningún perfil de facturación configurado para este usuario');
    }

    if (profile.type === 'NATURAL') {
      await this.prisma.personaNaturalBilling.delete({ where: { userId } });
    } else {
      await this.prisma.personaJuridicaBilling.delete({ where: { userId } });
    }

    return { message: 'Perfil de facturación eliminado con éxito' };
  }
}
